package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;

import org.json.JSONArray;
import org.json.JSONObject;

/** The near future: the rain outlook with the 15-minute nowcast bars from the city page. */
public class RainWidget extends BaseWidget {

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONObject rain = data.getJSONObject("rain");
        JSONArray bars = rain.getJSONArray("bars");
        float pad = 12;
        c.drawColor(WidgetPainter.BLACK);
        p.frame(c);

        p.text(c, rain.optString("text"), pad, pad + 12, 13, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, p.w - pad * 2);

        float bottom = p.h - pad - 15;
        float top = pad + 22;
        int n = bars.length();
        if (n > 0 && bottom - top >= 6) {
            float gap = n > 12 ? 2 : 4;
            float barW = (p.w - pad * 2 - gap * (n - 1)) / n;
            for (int i = 0; i < n; i++) {
                JSONObject b = bars.getJSONObject(i);
                float f = Math.max(0, Math.min(1, (float) b.optDouble("f", 0)));
                boolean wet = b.optBoolean("wet");
                float barH = Math.max(3, f * (bottom - top));
                float x = pad + i * (barW + gap);
                p.rect(c, x, bottom - barH, x + barW, bottom, wet ? p.accentMark : WidgetPainter.TRACK);
            }
        }

        float third = (p.w - pad * 2) / 3;
        p.text(c, rain.optString("from"), pad, p.h - pad, 11, p.regular, WidgetPainter.DIM, Paint.Align.LEFT, third);
        p.text(c, rain.optString("caption"), p.w / 2, p.h - pad, 11, p.regular, WidgetPainter.FAINT, Paint.Align.CENTER, third + 20);
        p.text(c, rain.optString("to"), p.w - pad, p.h - pad, 11, p.regular, WidgetPainter.DIM, Paint.Align.RIGHT, third);
    }

    @Override
    String describe(JSONObject data) {
        JSONObject rain = data.optJSONObject("rain");
        return rain == null ? "Rain outlook" : data.optString("city") + ": " + rain.optString("text");
    }

    @Override
    float[] defaultSize() {
        return new float[] { 320, 100 };
    }
}
