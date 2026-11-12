package nl.delaparraservices.apps.weather;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * A widget drawn as one image at its exact size, so it can look like the app
 * (bars, rules, the hero field) rather than a stock list of text views.
 */
abstract class BaseWidget extends AppWidgetProvider {

    /** Draws the widget for this snapshot; the painter knows the size and accent. */
    abstract void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception;

    /** Spoken by screen readers instead of the image. */
    abstract String describe(JSONObject data);

    /** Size used when the launcher reports none, in dp. */
    abstract float[] defaultSize();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    void render(Context context, AppWidgetManager manager, int id) {
        float[] size = sizeDp(manager.getAppWidgetOptions(id));
        float density = context.getResources().getDisplayMetrics().density;
        float scale = Math.min(density, 3f);
        int wPx = Math.max(1, Math.round(size[0] * scale));
        int hPx = Math.max(1, Math.round(size[1] * scale));

        Bitmap bitmap = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(scale, scale);
        WidgetPainter painter = new WidgetPainter(context, size[0], size[1]);
        JSONObject data = Widgets.snapshot(context);
        String description = "Weather Log";
        if (data == null) {
            painter.empty(canvas, "Weather Log", "Open the app to load the weather");
        } else {
            try {
                draw(canvas, painter, data);
                description = describe(data);
            } catch (Exception e) {
                canvas.drawColor(WidgetPainter.BLACK);
                painter.empty(canvas, "Weather Log", "Open the app to update");
            }
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_image);
        views.setImageViewBitmap(R.id.widget_image, bitmap);
        views.setContentDescription(R.id.widget_image, description);
        views.setOnClickPendingIntent(R.id.widget_image, Widgets.openApp(context));
        manager.updateAppWidget(id, views);
    }

    /** The widget's size in dp: exact on Android 12+, otherwise the portrait estimate. */
    private float[] sizeDp(Bundle options) {
        float[] fallback = defaultSize();
        if (options == null) return fallback;
        if (Build.VERSION.SDK_INT >= 31) {
            @SuppressWarnings("deprecation")
            ArrayList<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty()) {
                SizeF s = sizes.get(0);
                if (s.getWidth() > 0 && s.getHeight() > 0) return new float[] { s.getWidth(), s.getHeight() };
            }
        }
        int w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        return w > 0 && h > 0 ? new float[] { w, h } : fallback;
    }
}
