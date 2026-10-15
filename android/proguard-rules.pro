# Consumer rules, applied to every app that minifies with R8/ProGuard.
#
# Nitro creates HybridNitroOtpVerify from C++ via JNI, so R8 sees no constructor call
# and would strip <init> along with every field initializer. Keep the implementation and
# its package entry point whole; the generated spec and structs carry their own @Keep.
-keep class com.nitrootpverify.** { *; }
