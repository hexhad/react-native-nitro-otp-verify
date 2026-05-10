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

  private var receiver: BroadcastReceiver? = null
  private var otpHandler: ((otp: String) -> Unit)? = null

  override val memorySize: Long get() = 0L

  override fun getHash(): Promise<Array<String>> = Promise.async {
    arrayOf(computeAppHash(appContext))
  }

  override fun requestHint(): Promise<String> = Promise.async {
    ""
  }

  override fun startOtpListener(handler: (otp: String) -> Unit): Promise<Unit> = Promise.async {
    val ctx = appContext
    otpHandler = handler

    Tasks.await(SmsRetriever.getClient(ctx).startSmsRetriever())

    receiver = object : BroadcastReceiver() {
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

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      ctx.registerReceiver(receiver, filter)
    }
  }

  override fun stopOtpListener(): Promise<Unit> = Promise.async {
    receiver?.let { appContext.unregisterReceiver(it) }
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
