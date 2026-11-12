package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * History: today's high against the 1991–2020 average and the same date in earlier
 * years. Each row's bar is on one shared scale; the accent tick marks today on every row.
 */
public class ThisDayWidget extends BaseWidget {

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONObject thisDay = data.getJSONObject("thisDay");
        JSONArray rows = thisDay.getJSONArray("rows");
        float pad = 12;
        c.drawColor(WidgetPainter.BLACK);
        p.frame(c);

        p.kicker(c, "On this day · " + thisDay.optString("date"), pad, pad + 9, WidgetPainter.DIM, Paint.Align.LEFT, p.w - pad * 2);
        float top = pad + 22;
        float rowH = 21;
        int fit = Math.max(1, (int) ((p.h - top - pad + 6) / rowH));
        int count = Math.min(rows.length(), fit);

        float min = Float.MAX_VALUE, max = -Float.MAX_VALUE;
        Float today = null;
        for (int i = 0; i < count; i++) {
            JSONObject r = rows.getJSONObject(i);
            Float v = WidgetPainter.num(r, "v");
            if (v == null) continue;
            min = Math.min(min, v);
            max = Math.max(max, v);
            if ("today".equals(r.optString("kind"))) today = v;
        }
        float span = Math.max(4, max - min);
        min -= span * 0.15f;
        max += span * 0.05f;

        boolean bars = p.w >= 170 && min <= max;
        float labelW = 58;
        float valueW = 38;
        float barL = pad + labelW;
        float barR = p.w - pad - valueW;

        for (int i = 0; i < count; i++) {
            JSONObject r = rows.getJSONObject(i);
            String kind = r.optString("kind");
            boolean isToday = "today".equals(kind);
            float baseline = top + i * rowH + 12;
            int labelColor = isToday ? WidgetPainter.WHITE : "avg".equals(kind) ? WidgetPainter.DIM : WidgetPainter.PAST;
            p.text(c, r.optString("label"), pad, baseline, 12, isToday ? p.bold : p.regular, labelColor, Paint.Align.LEFT, labelW - 4);
            p.text(c, r.optString("text"), p.w - pad, baseline, 13, p.bold,
                isToday ? p.accentMark : WidgetPainter.WHITE, Paint.Align.RIGHT, valueW);

            Float v = WidgetPainter.num(r, "v");
            if (!bars || v == null || barR - barL < 20) continue;
            float y = baseline - 5;
            float x = barL + (v - min) / (max - min) * (barR - barL - 8);
            p.rect(c, barL, y - 2, barR - 8, y + 2, WidgetPainter.TRACK);
            int color = isToday ? p.accentMark : "avg".equals(kind) ? WidgetPainter.FAINT : WidgetPainter.PAST;
            p.rect(c, barL, y - 2, Math.max(barL + 2, x), y + 2, color);
            if (today != null && !isToday) {
                float tx = barL + (today - min) / (max - min) * (barR - barL - 8);
                p.rect(c, tx - 1, y - 5, tx + 1, y + 5, p.accentMark);
            }
        }

        if (rows.length() <= 2 && p.h >= top + rowH * 3) {
            p.text(c, "Earlier years load the next time the app is online", pad, top + 2 * rowH + 12, 11, p.regular,
                WidgetPainter.FAINT, Paint.Align.LEFT, p.w - pad * 2);
        }
    }

    @Override
    String describe(JSONObject data) {
        JSONObject thisDay = data.optJSONObject("thisDay");
        JSONArray rows = thisDay == null ? null : thisDay.optJSONArray("rows");
        if (rows == null) return "On this day";
        StringBuilder s = new StringBuilder("On this day in " + data.optString("city") + ". ");
        for (int i = 0; i < rows.length(); i++) {
            JSONObject r = rows.optJSONObject(i);
            if (r != null) s.append(r.optString("label")).append(' ').append(r.optString("text")).append(". ");
        }
        return s.toString();
    }

    @Override
    float[] defaultSize() {
        return new float[] { 250, 150 };
    }
}
