package sy.medpro.watani

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// منع لقطة الشاشة وتسجيل الفيديو — يُفعّل على شاشات الأسئلة/المحتوى فقط
class SecureFlagModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SecureFlag"

  @ReactMethod
  fun enable() {
    reactApplicationContext.currentActivity?.runOnUiThread {
      reactApplicationContext.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }

  @ReactMethod
  fun disable() {
    reactApplicationContext.currentActivity?.runOnUiThread {
      reactApplicationContext.currentActivity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }
}
