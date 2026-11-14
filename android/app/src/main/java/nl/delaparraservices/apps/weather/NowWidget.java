package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;

import org.json.JSONObject;

/**
 * The present: the app's hero on the accent field, with today against the average.
 * Wide, short sizes put the temperature beside the details; other sizes stack them.
 * Details drop out from least to most important as the widget shrinks, so what is
 * left is always drawn at a readable size.
 */
public class NowWidget extends BaseWidget {

    private static final float MIN_TEMP = 22;
    /** Height of a capital or digit as a share of the text size. */
    private static final float CAP = 0.72f;

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONObject now = data.getJSONObject("now");
        c.drawColor(p.accentField);
        if (p.accentOff) p.frame(c);
        if (p.w >= p.h * 1.6f && p.h < 140) {
            drawWide(c, p, data, now);
        } else {
            drawStacked(c, p, data, now);
        }
    }

    private void drawWide(Canvas c, WidgetPainter p, JSONObject data, JSONObject now) {
        float pad = p.h < 70 ? 10 : 14;
        String temp = now.optString("temp");
        float size = tempSize(p, temp, (p.h - pad * 2) / CAP, p.w * 0.4f);
        float tempW = p.measure(temp, size, p.heavy) * 0.96f;
        float baseline = (p.h + size * CAP * p.fontScale) / 2;
        drawTemp(c, p, temp, pad, baseline, size);

        float x = pad + tempW + 12;
        float colW = p.w - x - pad;
        if (colW < 48) return;
        float lineH = 17 * p.fontScale;
        int room = Math.max(1, (int) ((p.h - pad * 2 + 4) / lineH));
        String cond = now.optString("cond");
        float condSize = colW >= 110 ? 15 : 13;
        boolean wrap = room >= 2 && p.measure(cond, condSize, p.bold) > colW;
        int condLines = wrap ? 2 : 1;
        boolean showRange = room >= condLines + 1;
        boolean showCity = room >= condLines + 2;
        int count = condLines + (showRange ? 1 : 0) + (showCity ? 1 : 0);
        float y = (p.h - count * lineH) / 2 + lineH - 4;
        if (showCity) {
            p.text(c, data.optString("city"), x, y, 13, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, colW);
            y += lineH;
        }
        p.lines(c, cond, x, y, condSize, p.bold, WidgetPainter.WHITE, colW, condLines, lineH);
        y += lineH * condLines;
        if (showRange) p.text(c, range(p, now, colW), x, y, 12, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, colW);
    }

    private void drawStacked(Canvas c, WidgetPainter p, JSONObject data, JSONObject now) {
        float pad = Math.min(p.w, p.h) < 100 ? 10 : 14;
        float inner = p.w - pad * 2;
        float fs = p.fontScale;
        String cond = now.optString("cond");
        float condSize = p.h >= 108 ? 15 : 13;
        float condLine = (condSize + 3) * fs;
        float condGap = (condSize * CAP + 8) * fs;

        boolean showCity = p.h >= 100;
        boolean showCond = p.h >= 72;
        boolean wrap = showCond && p.measure(cond, condSize, p.bold) > inner;
        boolean showRange = p.h >= 108;
        boolean showDelta = p.h >= 150 && !now.isNull("delta");
        float minTemp = Math.max(MIN_TEMP * CAP * fs, (p.h - pad * 2) * 0.32f);
        while (true) {
            float used = (showCity ? 18 * fs : 0) + (showDelta ? 17 * fs : 0) + (showRange ? 18 * fs : 0)
                + (showCond ? condGap + (wrap ? condLine : 0) : 0);
            if (p.h - pad * 2 - used >= minTemp) break;
            if (showDelta) showDelta = false;
            else if (showCity) showCity = false;
            else if (wrap) wrap = false;
            else if (showRange) showRange = false;
            else if (showCond) showCond = false;
            else break;
        }

        float top = pad;
        if (showCity) {
            String updated = p.w >= 140 ? data.optString("updated") : "";
            float updatedW = updated.isEmpty() ? 0 : p.measure(updated, 11, p.regular);
            p.text(c, data.optString("city"), pad, pad + 11 * fs, 13, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT,
                inner - (updatedW > 0 ? updatedW + 8 : 0));
            if (updatedW > 0) {
                p.text(c, updated, p.w - pad, pad + 11 * fs, 11, p.regular, WidgetPainter.withAlpha(WidgetPainter.WHITE, 0.75f),
                    Paint.Align.RIGHT, updatedW + 1);
            }
            top = pad + 18 * fs;
        }

        float y = p.h - pad;
        if (showDelta) {
            p.text(c, now.optString("delta"), pad, y, 12, p.bold, WidgetPainter.withAlpha(WidgetPainter.WHITE, 0.8f), Paint.Align.LEFT, inner);
            y -= 17 * fs;
        }
        if (showRange) {
            p.text(c, range(p, now, inner), pad, y, 12, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, inner);
            y -= 18 * fs;
        }
        if (showCond) {
            if (wrap) y -= condLine;
            p.lines(c, cond, pad, y, condSize, p.bold, WidgetPainter.WHITE, inner, wrap ? 2 : 1, condLine);
            y -= condGap;
        }

        String temp = now.optString("temp");
        float size = tempSize(p, temp, (y - top) / CAP, inner);
        drawTemp(c, p, temp, pad, y, size);
    }

    /** High and low, with the chance of rain when it fits. */
    private static String range(WidgetPainter p, JSONObject now, float maxWidth) {
        String s = "H " + now.optString("hi") + "  L " + now.optString("lo");
        String withRain = s + "  ·  " + now.optString("rainLabel", "Rain " + now.optString("rain"));
        return p.measure(withRain, 12, p.bold) <= maxWidth ? withRain : s;
    }

    /** The largest size that fits the given height and width, never below a readable minimum. */
    private static float tempSize(WidgetPainter p, String temp, float byHeight, float maxWidth) {
        float size = Math.max(MIN_TEMP, Math.min(byHeight / p.fontScale, 150));
        float width = p.measure(temp, size, p.heavy);
        if (width > maxWidth) size = Math.max(MIN_TEMP, size * maxWidth / width);
        return size;
    }

    private static void drawTemp(Canvas c, WidgetPainter p, String temp, float x, float baseline, float size) {
        p.style(size, p.heavy, WidgetPainter.WHITE, Paint.Align.LEFT).setLetterSpacing(-0.04f);
        c.drawText(temp, x - size * 0.04f, baseline, p.text);
        p.text.setLetterSpacing(0);
    }

    @Override
    String describe(JSONObject data) {
        JSONObject now = data.optJSONObject("now");
        if (now == null) return "Weather Log";
        return data.optString("city") + ": " + now.optString("temp") + ", " + now.optString("cond")
            + ". High " + now.optString("hi") + ", low " + now.optString("lo") + ".";
    }

    @Override
    float[] defaultSize() {
        return new float[] { 150, 150 };
    }
}
