package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;

import org.json.JSONArray;
import org.json.JSONObject;

/** The coming hours: temperature and chance of rain, as many hours as fit. */
public class HourlyWidget extends BaseWidget {

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONArray hours = data.getJSONArray("hours");
        float pad = p.h < 56 ? 6 : 10;
        float fs = p.fontScale;
        c.drawColor(WidgetPainter.BLACK);
        p.frame(c);

        float minCol = 40 * fs;
        int n = Math.min(hours.length(), Math.max(2, (int) ((p.w - pad * 2) / minCol)));
        if (n == 0) return;
        float colW = (p.w - pad * 2) / n;
        float tempSize = p.h < 56 ? 15 : 17;
        float labelH = 13 * fs;
        float tempH = (tempSize + 4) * fs;
        float chanceH = 14 * fs;
        float barH = 9;
        float avail = p.h - pad * 2;
        boolean bars = avail >= labelH + tempH + chanceH + barH + 8;
        boolean chance = !bars && avail >= labelH + tempH + chanceH;
        float block = labelH + tempH + (chance ? chanceH : 0);
        float labelY = bars ? pad + labelH : pad + (avail - block) / 2 + labelH;
        float tempY = labelY + tempH;

        for (int i = 0; i < n; i++) {
            JSONObject hr = hours.getJSONObject(i);
            float x = pad + colW * (i + 0.5f);
            boolean now = i == 0;
            p.text(c, hr.optString("label"), x, labelY - 2, 11, now ? p.bold : p.regular,
                now ? WidgetPainter.WHITE : WidgetPainter.DIM, Paint.Align.CENTER, colW - 2);
            p.text(c, hr.optString("temp"), x, tempY - 2, tempSize, p.bold, WidgetPainter.WHITE, Paint.Align.CENTER, colW - 2);

            int pct = hr.optInt("p", 0);
            boolean wet = pct >= 50;
            if (bars) {
                p.text(c, pct + "%", x, p.h - pad - barH, 11, wet ? p.bold : p.regular,
                    wet ? p.accentMark : WidgetPainter.FAINT, Paint.Align.CENTER, colW - 2);
                float barL = x - colW / 2 + 4;
                float barR = x + colW / 2 - 4;
                p.rect(c, barL, p.h - pad - 3, barR, p.h - pad, WidgetPainter.TRACK);
                p.rect(c, barL, p.h - pad - 3, barL + (barR - barL) * Math.min(100, pct) / 100f, p.h - pad, p.accentMark);
            } else if (chance && pct >= 30) {
                p.text(c, pct + "%", x, tempY + chanceH - 2, 11, p.bold, p.accentMark, Paint.Align.CENTER, colW - 2);
            }
        }
    }

    @Override
    String describe(JSONObject data) {
        JSONArray hours = data.optJSONArray("hours");
        StringBuilder s = new StringBuilder("Next hours in " + data.optString("city") + ". ");
        for (int i = 0; hours != null && i < Math.min(6, hours.length()); i++) {
            JSONObject hr = hours.optJSONObject(i);
            if (hr != null) s.append(hr.optString("label")).append(' ').append(hr.optString("temp"))
                .append(", ").append(hr.optInt("p")).append("% rain. ");
        }
        return s.toString();
    }

    @Override
    float[] defaultSize() {
        return new float[] { 320, 100 };
    }
}
