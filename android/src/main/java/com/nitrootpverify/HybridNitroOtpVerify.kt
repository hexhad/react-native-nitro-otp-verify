package com.nitrootpverify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.util.Base64
import androidx.annotation.Keep
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import com.google.android.gms.tasks.Tasks
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.nitrootpverify.HybridNitroOtpVerifySpec
import com.margelo.nitro.nitrootpverify.SmsRetrieverEvent
import com.margelo.nitro.nitrootpverify.SmsRetrieverStatus
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

// Nitro instantiates this class from C++ through JNI, which R8 cannot see. Without these
// annotations a minified release build strips the constructor and field initializers.
@DoNotStrip
@Keep
class HybridNitroOtpVerify : HybridNitroOtpVerifySpec() {

  private val lock = Any()
  private var handler: ((event: SmsRetrieverEvent) -> Unit)? = null
  private var receiver: BroadcastReceiver? = null
  private var sessionStartedAt = 0L

  override val memorySize: Long get() = 0L

  override val isSupported: Boolean by lazy {
    NitroModules.applicationContext?.let {
      GoogleApiAvailability.getInstance()
        .isGooglePlayServicesAvailable(it) == ConnectionResult.SUCCESS
    } ?: false
  }

  // The signing certificate can't change at runtime, so hash once.
  private val appHashes: Array<String> by lazy {
    NitroModules.applicationContext?.let { computeAppHashes(it) } ?: emptyArray()
  }

  override fun getHash(): Array<String> = appHashes

  override fun startOtpListener(handler: (event: SmsRetrieverEvent) -> Unit): Promise<Unit> =
    Promise.async {
      val ctx = appContext
      stopOtpListener()

      val rx = createReceiver()
      synchronized(lock) {
        this.handler = handler
        receiver = rx
        sessionStartedAt = SystemClock.elapsedRealtime()
      }
      // The broadcast comes from Play services (another app), so the receiver must be
      // exported on Android 13+; SEND_PERMISSION ensures only Play services can deliver it,
      // otherwise any installed app could broadcast a spoofed OTP.
      ContextCompat.registerReceiver(
        ctx,
        rx,
        IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
        SmsRetriever.SEND_PERMISSION,
        null,
        ContextCompat.RECEIVER_EXPORTED
      )

      try {
        Tasks.await(SmsRetriever.getClient(ctx).startSmsRetriever())
      } catch (e: Exception) {
        stopOtpListener()
        throw e
      }
    }

  override fun stopOtpListener() {
    val rx = synchronized(lock) {
      handler = null
      receiver.also { receiver = null }
    } ?: return
    try {
      NitroModules.applicationContext?.unregisterReceiver(rx)
    } catch (_: IllegalArgumentException) {
      // Already unregistered
    }
  }

  /** Delivers [event] to the active handler at most once, then ends the session. */
  private fun finish(event: SmsRetrieverEvent) {
    val h = synchronized(lock) { handler }
    stopOtpListener()
    h?.invoke(event)
  }

  private fun createReceiver() = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
      val extras = intent.extras ?: return
      val status = IntentCompat.getParcelableExtra(intent, SmsRetriever.EXTRA_STATUS, Status::class.java)
        ?: return
      when (status.statusCode) {
        CommonStatusCodes.SUCCESS -> {
          val message = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE) ?: return
          finish(SmsRetrieverEvent(SmsRetrieverStatus.RECEIVED, message, null))
        }
        CommonStatusCodes.TIMEOUT -> {
          // Restarting doesn't cancel an earlier retriever's 5-minute timer, so its
          // TIMEOUT can land on this session. Only accept our own.
          val elapsed = SystemClock.elapsedRealtime() - synchronized(lock) { sessionStartedAt }
          if (elapsed < MIN_TIMEOUT_MS) return
          finish(SmsRetrieverEvent(SmsRetrieverStatus.TIMEOUT, null, null))
        }
        else -> finish(
          SmsRetrieverEvent(
            SmsRetrieverStatus.ERROR,
            null,
            CommonStatusCodes.getStatusCodeString(status.statusCode)
          )
        )
      }
    }
  }

  // ── App hash computation ──────────────────────────────────────────────

  private fun computeAppHashes(ctx: Context): Array<String> = try {
    val packageName = ctx.packageName
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val info = ctx.packageManager.getPackageInfo(
        packageName,
        PackageManager.GET_SIGNING_CERTIFICATES
      )
      info.signingInfo?.apkContentsSigners ?: emptyArray()
    } else {
      @Suppress("DEPRECATION")
      val info = ctx.packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
      @Suppress("DEPRECATION")
      info.signatures ?: emptyArray()
    }

    signatures.map { signature ->
      val digest = MessageDigest.getInstance("SHA-256").digest(
        "$packageName ${signature.toCharsString()}".toByteArray(StandardCharsets.UTF_8)
      )
      Base64.encodeToString(digest, Base64.NO_PADDING or Base64.NO_WRAP).substring(0, 11)
    }.distinct().toTypedArray()
  } catch (_: Exception) {
    emptyArray()
  }

  private companion object {
    // Play services times a session out after 5 minutes; allow for clock slack
    const val MIN_TIMEOUT_MS = 5 * 60 * 1000L - 15 * 1000L
  }

  private val appContext: Context
    get() = NitroModules.applicationContext
      ?: error("Application context not available")
}
