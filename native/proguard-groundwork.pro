# R8 rules for release builds (native/release.gradle). Capacitor finds plugins and their methods by name at run time,
# so keep our plugin package, Capacitor itself and every plugin class; widgets, receivers and the tile are kept
# through the manifest.
-keep class app.groundwork.nativebridge.** { *; }
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn com.getcapacitor.**
