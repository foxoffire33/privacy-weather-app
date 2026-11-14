package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Past, present and future on one axis: the last 7 logged days, today and the next
 * 6 forecast days as low–high ranges, with the 1991–2020 average as a thin line.
 * Today is marked with the logo's line and circle.
 */
public class TimelineWidget extends BaseWidget {

    private static final float MIN_CHART = 28;

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONArray days = data.getJSONObject("timeline").getJSONArray("days");
        int n = days.length();
        float pad = 12;
        c.drawColor(WidgetPainter.BLACK);
        p.frame(c);

        float fs = p.fontScale;
        boolean header = p.h - pad * 2 - 26 * fs - 16 * fs >= MIN_CHART;
        boolean labels = p.h - pad * 2 - (header ? 26 * fs : 14 * fs) - 16 * fs >= MIN_CHART;

        // Header: what is logged and what is forecast.
        float half = (p.w - pad * 2) / 2;
        if (header) {
            p.kicker(c, WidgetPainter.label(data, "past7", "Past 7 days"), pad, pad + 9 * fs, WidgetPainter.DIM, Paint.Align.LEFT, half - 4);
            p.kicker(c, WidgetPainter.label(data, "forecast", "Forecast"), p.w - pad, pad + 9 * fs, WidgetPainter.DIM, Paint.Align.RIGHT, half - 4);
        }
        if (header && p.w >= 260 + 40 * (fs - 1)) {
            // Legend for the average line.
            float lx = p.w / 2 - 22;
            p.rect(c, lx, pad + 5, lx + 17, pad + 6.5f, WidgetPainter.FAINT);
            p.text(c, WidgetPainter.label(data, "average", "average"), lx + 22, pad + 9, 10, p.regular, WidgetPainter.FAINT, Paint.Align.LEFT, 60);
        }

        float top = pad + (header ? 26 : 14) * fs;
        float bottom = p.h - pad - (labels ? 16 * fs : 0);
        if (bottom - top < 12 || n == 0) return;
        float colW = (p.w - pad * 2) / n;

        // Vertical scale over every value shown.
        float min = Float.MAX_VALUE, max = -Float.MAX_VALUE;
        for (int i = 0; i < n; i++) {
            JSONObject d = days.getJSONObject(i);
            for (String k : new String[] { "hi", "lo", "normal" }) {
                Float v = WidgetPainter.num(d, k);
                if (v == null) continue;
                min = Math.min(min, v);
                max = Math.max(max, v);
            }
        }
        if (min > max) return;
        float span = Math.max(4, max - min);
        min -= span * 0.08f;
        max += span * 0.08f;
        final float fMin = min, fRange = max - min;

        int todayIndex = -1;
        for (int i = 0; i < n; i++) {
            if ("today".equals(days.getJSONObject(i).optString("kind"))) todayIndex = i;
        }

        // Today: the logo's vertical line behind its column.
        if (todayIndex >= 0) {
            float x = pad + colW * (todayIndex + 0.5f);
            p.rect(c, x - 0.5f, top - 6, x + 0.5f, bottom, WidgetPainter.withAlpha(WidgetPainter.WHITE, 0.35f));
        }

        // Average: thin solid line through each day's normal.
        Path avg = new Path();
        boolean open = false;
        for (int i = 0; i < n; i++) {
            Float v = WidgetPainter.num(days.getJSONObject(i), "normal");
            if (v == null) { open = false; continue; }
            float x = pad + colW * (i + 0.5f);
            float y = bottom - (v - fMin) / fRange * (bottom - top);
            if (open) avg.lineTo(x, y); else avg.moveTo(x, y);
            open = true;
        }
        Paint dots = new Paint(Paint.ANTI_ALIAS_FLAG);
        dots.setStyle(Paint.Style.STROKE);
        dots.setStrokeWidth(1.5f);
        dots.setColor(WidgetPainter.FAINT);
        c.drawPath(avg, dots);

        // Ranges: logged days in grey, today solid accent, forecast lighter accent. Gaps stay visible.
        float barW = Math.max(3, Math.min(colW * 0.42f, 10));
        float labelW = p.measure("We", 10, p.bold) + 6;
        int every = Math.max(1, (int) Math.ceil(labelW / colW));
        for (int i = 0; i < n; i++) {
            JSONObject d = days.getJSONObject(i);
            String kind = d.optString("kind");
            float x = pad + colW * (i + 0.5f);
            Float hi = WidgetPainter.num(d, "hi");
            Float lo = WidgetPainter.num(d, "lo");
            if (hi == null || lo == null) {
                float y = (top + bottom) / 2;
                p.rect(c, x - barW / 2, y - 1, x + barW / 2, y + 1, WidgetPainter.FAINT);
            } else {
                int color = "past".equals(kind) ? WidgetPainter.PAST
                    : "today".equals(kind) ? p.accentMark
                    : WidgetPainter.withAlpha(p.accentMark, 0.6f);
                float yHi = bottom - (hi - fMin) / fRange * (bottom - top);
                float yLo = bottom - (lo - fMin) / fRange * (bottom - top);
                p.rect(c, x - barW / 2, yHi, x + barW / 2, Math.max(yLo, yHi + 2), color);
            }
            boolean isToday = i == todayIndex;
            boolean labelled = isToday || (todayIndex >= 0
                ? Math.abs(i - todayIndex) % every == 0 && Math.abs(i - todayIndex) >= every
                : i % every == 0);
            if (labels && labelled) {
                p.text(c, d.optString("label"), x, p.h - pad, 10, isToday ? p.bold : p.regular,
                    isToday ? WidgetPainter.WHITE : WidgetPainter.DIM, Paint.Align.CENTER, colW * every);
            }
        }

        // Today: the logo's circle on top of the range, with the high next to it.
        if (todayIndex >= 0) {
            JSONObject d = days.getJSONObject(todayIndex);
            Float hi = WidgetPainter.num(d, "hi");
            if (hi != null) {
                float x = pad + colW * (todayIndex + 0.5f);
                float y = bottom - (hi - fMin) / fRange * (bottom - top);
                Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
                ring.setStyle(Paint.Style.FILL);
                ring.setColor(WidgetPainter.BLACK);
                c.drawCircle(x, y, 5.5f, ring);
                ring.setStyle(Paint.Style.STROKE);
                ring.setStrokeWidth(2);
                ring.setColor(WidgetPainter.WHITE);
                c.drawCircle(x, y, 4.5f, ring);
                String label = data.getJSONObject("timeline").optString("todayHi");
                p.text(c, label, x, Math.max(y - 9, pad + 11 * fs), 11, p.bold, WidgetPainter.WHITE, Paint.Align.CENTER, colW * 3);
            }
        }
    }

    @Override
    String describe(JSONObject data) {
        JSONObject t = data.optJSONObject("timeline");
        return "Temperature timeline for " + data.optString("city") + ": the past 7 days, today ("
            + (t == null ? "" : t.optString("todayHi")) + ") and the next 6 days, with the average.";
    }

    @Override
    float[] defaultSize() {
        return new float[] { 320, 150 };
    }
}
