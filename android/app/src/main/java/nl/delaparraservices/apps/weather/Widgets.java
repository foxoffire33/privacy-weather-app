package nl.delaparraservices.apps.weather;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/**
 * Shared state for the home-screen widgets. The web app sends one JSON snapshot
 * (src/lib/widgets.ts) of the default city's past, present and future; every widget
 * draws from it. The accent colour comes from AppIconPlugin's preferences.
 */
final class Widgets {

    private static final String PREFS = "widgets";
    private static final String KEY_SNAPSHOT = "snapshot";

    @SuppressWarnings("unchecked")
    static final Class<? extends AppWidgetProvider>[] PROVIDERS = new Class[] {
        NowWidget.class, TimelineWidget.class, ThisDayWidget.class, RainWidget.class, HourlyWidget.class,
    };

    private Widgets() {}

    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SNAPSHOT, json).apply();
    }

    /** The latest snapshot, or null when the app has not loaded any weather yet. */
    static JSONObject snapshot(Context context) {
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, "");
        if (json == null || json.isEmpty()) return null;
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }

    /** Redraws every placed widget. */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<? extends AppWidgetProvider> provider : PROVIDERS) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
            if (ids == null || ids.length == 0) continue;
            Intent intent = new Intent(context, provider)
                .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(intent);
        }
    }

    /** Tapping a widget opens the app, which refreshes the weather and the widgets. */
    static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
