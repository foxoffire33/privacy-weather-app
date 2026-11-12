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
        float pad = 10;
        c.drawColor(WidgetPainter.BLACK);
        p.frame(c);

        int n = Math.min(hours.length(), Math.max(3, (int) ((p.w - pad * 2) / 40)));
        if (n == 0) return;
        float colW = (p.w - pad * 2) / n;
        boolean tall = p.h >= 92;
        float labelY = tall ? pad + 14 : p.h / 2 - 10;
        float tempY = labelY + 22;

        for (int i = 0; i < n; i++) {
            JSONObject hr = hours.getJSONObject(i);
            float x = pad + colW * (i + 0.5f);
            boolean now = i == 0;
            p.text(c, hr.optString("label"), x, labelY, 11, now ? p.bold : p.regular,
                now ? WidgetPainter.WHITE : WidgetPainter.DIM, Paint.Align.CENTER, colW);
            p.text(c, hr.optString("temp"), x, tempY, 17, p.bold, WidgetPainter.WHITE, Paint.Align.CENTER, colW);

            int chance = hr.optInt("p", 0);
            if (tall) {
                p.text(c, chance + "%", x, p.h - pad - 9, 11, chance >= 50 ? p.bold : p.regular,
                    chance >= 50 ? p.accentMark : WidgetPainter.FAINT, Paint.Align.CENTER, colW);
                float barL = x - colW / 2 + 4;
                float barR = x + colW / 2 - 4;
                p.rect(c, barL, p.h - pad - 3, barR, p.h - pad, WidgetPainter.TRACK);
                p.rect(c, barL, p.h - pad - 3, barL + (barR - barL) * Math.min(100, chance) / 100f, p.h - pad, p.accentMark);
            } else if (chance >= 30) {
                p.text(c, chance + "%", x, tempY + 14, 10, p.bold, p.accentMark, Paint.Align.CENTER, colW);
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
