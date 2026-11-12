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
 * alias per accent (LauncherGreen, LauncherRed, LauncherBlue, LauncherOff) plus 25 extra
 * colours for custom accents (LauncherH000l and so on). The web app
 * calls setAccent() whenever the accent changes; the switch itself happens in apply(),
 * called when the app goes to the background, so it never interrupts the user.
 *
 * The accent is also stored in SharedPreferences ("accent_color", a #rrggbb hex) so
 * the home-screen widgets (WidgetPainter) use the same colour.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    public static final String PREFS = "app_icon";
    public static final String KEY_ALIAS = "alias";
    public static final String KEY_ACCENT_COLOR = "accent_color";

    private static final String DEFAULT_ALIAS = "green";
    private static final String[] ALIASES = { "green", "red", "blue", "off",
        "h000l", "h000d", "h030l", "h030d", "h060l", "h060d", "h090l", "h090d", "h120l", "h120d", "h150l", "h150d", "h180l", "h180d", "h210l", "h210d", "h240l", "h240d", "h270l", "h270d", "h300l", "h300d", "h330l", "h330d", "grey" };
    // Icon background of every alias except "off" (same order), used to match a custom accent.
    private static final int[] COLORS = { 0x178A4A, 0xEC3013, 0x2F62F5, 0x000000,
        0xD51A1A, 0x8C1717, 0xD5781A, 0x8C5217, 0xD5D51A, 0x8C8C17, 0x78D51A, 0x528C17, 0x1AD51A, 0x178C17, 0x1AD578, 0x178C52, 0x1AD5D5, 0x178C8C, 0x1A78D5, 0x17528C, 0x1A1AD5, 0x17178C, 0x781AD5, 0x52178C, 0xD51AD5, 0x8C178C, 0xD51A78, 0x8C1752, 0x6E6B6B };

    @PluginMethod
    public void setAccent(PluginCall call) {
        String accent = call.getString("accent", DEFAULT_ALIAS);
        String color = call.getString("color", "#178a4a");
        String alias = isAlias(accent) ? accent : nearestAlias(color);
        prefs(getContext()).edit()
            .putString(KEY_ALIAS, alias)
            .putString(KEY_ACCENT_COLOR, color)
            .apply();
        // Widgets use the accent too: redraw them right away.
        Widgets.updateAll(getContext());
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

    /** A custom accent gets the icon whose colour is closest (weighted RGB distance). */
    static String nearestAlias(String hex) {
        int rgb;
        try {
            rgb = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return DEFAULT_ALIAS;
        }
        int r = Color.red(rgb), g = Color.green(rgb), b = Color.blue(rgb);
        String best = DEFAULT_ALIAS;
        long bestDistance = Long.MAX_VALUE;
        for (int i = 0; i < ALIASES.length; i++) {
            if ("off".equals(ALIASES[i])) continue;
            int c = COLORS[i];
            long dr = r - ((c >> 16) & 0xFF), dg = g - ((c >> 8) & 0xFF), db = b - (c & 0xFF);
            long d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
            if (d < bestDistance) {
                bestDistance = d;
                best = ALIASES[i];
            }
        }
        return best;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
