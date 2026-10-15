package com.nitrootpverify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.tasks.Tasks
import com.margelo.nitro.nitrootpverify.HybridNitroOtpVerifySpec
import com.margelo.nitro.core.Promise
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

class HybridNitroOtpVerify : HybridNitroOtpVerifySpec() {

  @Volatile private var receiver: BroadcastReceiver? = null
  @Volatile private var otpHandler: ((otp: String) -> Unit)? = null

  override val memorySize: Long get() = 0L

  override fun getHash(): Promise<Array<String>> = Promise.async {
    arrayOf(computeAppHash(appContext))
  }

  override fun requestHint(): Promise<String> = Promise.async {
    ""
  }

  override fun startOtpListener(handler: (otp: String) -> Unit): Promise<Unit> = Promise.async {
    val ctx = appContext
    // Drop any previous registration so repeated starts don't leak receivers.
    unregisterReceiver(ctx)

    Tasks.await(SmsRetriever.getClient(ctx).startSmsRetriever())

    val newReceiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val status = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.extras?.getParcelable(
            SmsRetriever.EXTRA_STATUS,
            com.google.android.gms.common.api.Status::class.java
          )
        } else {
          @Suppress("DEPRECATION")
          intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? com.google.android.gms.common.api.Status
        } ?: return
        if (status.statusCode == CommonStatusCodes.SUCCESS) {
          val msg = intent.extras
            ?.getString(SmsRetriever.EXTRA_SMS_MESSAGE) ?: return
          otpHandler?.invoke(msg)
        }
      }
    }

    // Only Play Services (holder of SEND_PERMISSION) may deliver to this receiver,
    // otherwise any installed app could broadcast a spoofed OTP.
    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    synchronized(this) {
      otpHandler = handler
      receiver = newReceiver
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ctx.registerReceiver(
          newReceiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED
        )
      } else {
        ctx.registerReceiver(newReceiver, filter, SmsRetriever.SEND_PERMISSION, null)
      }
    }
  }

  override fun stopOtpListener(): Promise<Unit> = Promise.async {
    unregisterReceiver(appContext)
  }

  @Synchronized
  private fun unregisterReceiver(ctx: Context) {
    receiver?.let {
      try {
        ctx.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
        // Already unregistered
      }
    }
    receiver = null
    otpHandler = null
  }

  // ── App hash computation ──────────────────────────────────────────────

  private fun computeAppHash(ctx: Context): String {
    return try {
      val packageName = ctx.packageName
      val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = ctx.packageManager.getPackageInfo(
          packageName,
          PackageManager.GET_SIGNING_CERTIFICATES
        )
        info.signingInfo?.apkContentsSigners ?: emptyArray()
      } else {
        @Suppress("DEPRECATION")
        val info = ctx.packageManager.getPackageInfo(
          packageName,
          PackageManager.GET_SIGNATURES
        )
        @Suppress("DEPRECATION")
        info.signatures ?: emptyArray()
      }

      val md = MessageDigest.getInstance("SHA-256")
      val digest = md.digest(
        "$packageName ${signatures.firstOrNull()?.toCharsString() ?: ""}".toByteArray(
          StandardCharsets.UTF_8
        )
      )
      Base64.encodeToString(digest, Base64.NO_PADDING or Base64.NO_WRAP)
        .substring(0, 11)
    } catch (e: Exception) {
      ""
    }
  }

  private val appContext: Context
    get() = com.margelo.nitro.NitroModules.applicationContext
      ?: error("Application context not available")
}
