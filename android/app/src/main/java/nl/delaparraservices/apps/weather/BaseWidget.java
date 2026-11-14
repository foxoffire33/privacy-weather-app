package nl.delaparraservices.apps.weather;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Build;
import android.os.Bundle;
import android.util.ArrayMap;
import android.util.DisplayMetrics;
import android.util.SizeF;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A widget drawn as one image at its exact size, so it can look like the app
 * (bars, rules, the hero field) rather than a stock list of text views.
 */
abstract class BaseWidget extends AppWidgetProvider {

    /** Draws the widget for this snapshot; the painter knows the size and accent. */
    abstract void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception;

    /** Spoken by screen readers instead of the image. */
    abstract String describe(JSONObject data);

    /** Android 12+ launchers report a few sizes; more would only cost memory. */
    private static final int MAX_SIZES = 4;
    /** Share of the system's widget bitmap limit these images may use. */
    private static final double BITMAP_SHARE = 0.8;

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
        Bundle options = manager.getAppWidgetOptions(id);
        JSONObject data = Widgets.snapshot(context);
        List<float[]> sizes = sizesDp(options);
        float scale = bitmapScale(context, sizes);
        RemoteViews views;
        if (Build.VERSION.SDK_INT >= 31 && reportsSizes(options)) {
            Map<SizeF, RemoteViews> bySize = new ArrayMap<>();
            for (float[] size : sizes) bySize.put(new SizeF(size[0], size[1]), view(context, data, size, scale));
            views = new RemoteViews(bySize);
        } else if (sizes.size() == 2) {
            views = new RemoteViews(view(context, data, sizes.get(1), scale), view(context, data, sizes.get(0), scale));
        } else {
            views = view(context, data, sizes.get(0), scale);
        }
        manager.updateAppWidget(id, views);
    }

    /** One image drawn at exactly this size, so nothing is stretched or shrunk by the launcher. */
    private RemoteViews view(Context context, JSONObject data, float[] size, float scale) {
        int wPx = Math.max(1, Math.round(size[0] * scale));
        int hPx = Math.max(1, Math.round(size[1] * scale));
        Bitmap bitmap = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(scale, scale);
        WidgetPainter painter = new WidgetPainter(context, size[0], size[1]);
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
        return views;
    }

    private static boolean reportsSizes(Bundle options) {
        if (options == null || Build.VERSION.SDK_INT < 31) return false;
        @SuppressWarnings("deprecation")
        ArrayList<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
        return sizes != null && !sizes.isEmpty();
    }

    /**
     * Every size the launcher may show the widget at, in dp. Android 12+ reports them all;
     * older versions give a portrait (min width × max height) and a landscape (max width ×
     * min height) size, listed in that order.
     */
    private List<float[]> sizesDp(Bundle options) {
        List<float[]> out = new ArrayList<>();
        if (options != null && Build.VERSION.SDK_INT >= 31) {
            @SuppressWarnings("deprecation")
            ArrayList<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null) {
                for (SizeF s : sizes) add(out, s.getWidth(), s.getHeight());
            }
            if (!out.isEmpty()) return out.size() > MAX_SIZES ? out.subList(0, MAX_SIZES) : out;
        }
        if (options != null) {
            add(out, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0));
            add(out, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0));
        }
        if (out.isEmpty()) out.add(defaultSize());
        return out;
    }

    private static void add(List<float[]> out, float w, float h) {
        if (w <= 0 || h <= 0) return;
        for (float[] s : out) {
            if (Math.abs(s[0] - w) < 1 && Math.abs(s[1] - h) < 1) return;
        }
        out.add(new float[] { w, h });
    }

    /**
     * Pixels per dp for the images: the screen density, capped at 3, and lowered when the
     * images together would pass the system's limit for widget bitmaps (1.5 × the screen).
     */
    private static float bitmapScale(Context context, List<float[]> sizes) {
        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        float scale = Math.min(metrics.density, 3f);
        double area = 0;
        for (float[] s : sizes) area += s[0] * s[1];
        double budget = metrics.widthPixels * (double) metrics.heightPixels * 1.5 * BITMAP_SHARE;
        double needed = area * scale * scale;
        if (needed > budget && area > 0) scale = (float) Math.sqrt(budget / area);
        return Math.max(1f, scale);
    }
}
