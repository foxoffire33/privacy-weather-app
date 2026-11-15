package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;

import org.json.JSONArray;
import org.json.JSONObject;

/** The near future: the rain outlook with the 15-minute nowcast bars from the city page. */
public class RainWidget extends BaseWidget {

    private static final float MIN_BARS = 14;

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONObject rain = data.getJSONObject("rain");
        JSONArray bars = rain.getJSONArray("bars");
        float pad = p.h < 80 ? 10 : 12;
        float fs = p.fontScale;
        float inner = p.w - pad * 2;
        c.drawColor(WidgetPainter.BLACK);
        p.frame(c);

        float lineH = 16 * fs;
        String text = rain.optString("text");
        boolean fitsOnOne = p.measure(text, 13, p.bold) <= inner;
        int maxLines = !fitsOnOne && p.h - pad * 2 - lineH * 2 - 6 >= MIN_BARS ? 2 : 1;
        float footerH = 15 * fs;
        boolean footer = p.h >= 84 && p.h - pad * 2 - lineH * maxLines - 6 - footerH - 4 >= MIN_BARS;
        if (!footer) footerH = 0;
        int drawn = p.lines(c, text, pad, pad + 12 * fs, 13, p.bold, WidgetPainter.WHITE, inner, maxLines, lineH);

        float top = pad + lineH * drawn + 6;
        float bottom = p.h - pad - footerH - (footer ? 4 : 0);
        int n = bars.length();
        if (n > 0 && bottom - top >= 8) {
            float gap = n > 12 || inner / n < 10 ? 2 : 4;
            float barW = Math.max(1, (inner - gap * (n - 1)) / n);
            for (int i = 0; i < n; i++) {
                JSONObject b = bars.getJSONObject(i);
                float f = Math.max(0, Math.min(1, (float) b.optDouble("f", 0)));
                boolean wet = b.optBoolean("wet");
                float barH = Math.max(3, f * (bottom - top));
                float x = pad + i * (barW + gap);
                p.rect(c, x, bottom - barH, x + barW, bottom, wet ? p.accentMark : WidgetPainter.TRACK);
            }
        }

        if (footer) {
            String from = rain.optString("from");
            String to = rain.optString("to");
            float sideW = Math.max(p.measure(from, 11, p.regular), p.measure(to, 11, p.regular)) + 2;
            p.text(c, from, pad, p.h - pad, 11, p.regular, WidgetPainter.DIM, Paint.Align.LEFT, sideW);
            p.text(c, to, p.w - pad, p.h - pad, 11, p.regular, WidgetPainter.DIM, Paint.Align.RIGHT, sideW);
            String caption = rain.optString("caption");
            float middle = inner - sideW * 2 - 16;
            if (p.measure(caption, 11, p.regular) <= middle) {
                p.text(c, caption, p.w / 2, p.h - pad, 11, p.regular, WidgetPainter.FAINT, Paint.Align.CENTER, middle);
            }
        }
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
