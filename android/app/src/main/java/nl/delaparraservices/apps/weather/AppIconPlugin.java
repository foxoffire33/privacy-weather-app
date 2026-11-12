package nl.delaparraservices.apps.weather;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Makes the launcher icon follow the accent colour chosen in Settings.
 *
 * Android can't recolour an installed icon, so the manifest declares one launcher
 * alias per accent (LauncherGreen, LauncherRed, LauncherBlue, LauncherOff). The web app
 * calls setAccent() whenever the accent changes; the switch itself happens in apply(),
 * called when the app goes to the background, so it never interrupts the user.
 *
 * The accent is also stored in SharedPreferences ("accent_color", a #rrggbb hex) so
 * native parts such as home-screen widgets can use the same colour.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    public static final String PREFS = "app_icon";
    public static final String KEY_ALIAS = "alias";
    public static final String KEY_ACCENT_COLOR = "accent_color";

    private static final String DEFAULT_ALIAS = "green";
    private static final String[] ALIASES = { "green", "red", "blue", "off" };
    // Hues of the green, red and blue accents, used to pick the nearest icon for a custom colour.
    private static final float[] PRESET_HUES = { 146f, 8f, 225f };

    @PluginMethod
    public void setAccent(PluginCall call) {
        String accent = call.getString("accent", DEFAULT_ALIAS);
        String color = call.getString("color", "#178a4a");
        String alias = isAlias(accent) ? accent : nearestAlias(color);
        prefs(getContext()).edit()
            .putString(KEY_ALIAS, alias)
            .putString(KEY_ACCENT_COLOR, color)
            .apply();
        call.resolve();
    }

    /** Enables the launcher alias for the saved accent and disables the others. */
    public static void apply(Context context) {
        String wanted = prefs(context).getString(KEY_ALIAS, null);
        if (wanted == null || !isAlias(wanted)) return;

        PackageManager pm = context.getPackageManager();
        // Enable the new entry before disabling the old one, so there is always one launcher icon.
        setEnabled(context, pm, wanted, true);
        for (String alias : ALIASES) {
            if (!alias.equals(wanted)) setEnabled(context, pm, alias, false);
        }
    }

    private static void setEnabled(Context context, PackageManager pm, String alias, boolean enabled) {
        String className = MainActivity.class.getPackage().getName() + ".Launcher"
            + Character.toUpperCase(alias.charAt(0)) + alias.substring(1);
        ComponentName component = new ComponentName(context.getPackageName(), className);
        int current = pm.getComponentEnabledSetting(component);
        boolean enabledNow = current == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            || (current == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && alias.equals(DEFAULT_ALIAS));
        if (enabledNow == enabled) return;
        pm.setComponentEnabledSetting(
            component,
            enabled ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP);
    }

    private static boolean isAlias(String value) {
        for (String alias : ALIASES) if (alias.equals(value)) return true;
        return false;
    }

    /** A custom accent gets the icon whose accent hue is closest. */
    static String nearestAlias(String hex) {
        int rgb;
        try {
            rgb = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return DEFAULT_ALIAS;
        }
        float[] hsv = new float[3];
        Color.colorToHSV(rgb, hsv);
        int best = 0;
        float bestDistance = Float.MAX_VALUE;
        for (int i = 0; i < PRESET_HUES.length; i++) {
            float d = Math.abs(hsv[0] - PRESET_HUES[i]);
            d = Math.min(d, 360f - d);
            if (d < bestDistance) {
                bestDistance = d;
                best = i;
            }
        }
        return ALIASES[best];
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
