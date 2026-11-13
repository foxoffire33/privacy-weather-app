package nl.delaparraservices.apps.weather;

import android.graphics.Canvas;
import android.graphics.Paint;

import org.json.JSONObject;

/** The present: the app's hero on the accent field, with today against the average. */
public class NowWidget extends BaseWidget {

    @Override
    void draw(Canvas c, WidgetPainter p, JSONObject data) throws Exception {
        JSONObject now = data.getJSONObject("now");
        float pad = 14;
        float inner = p.w - pad * 2;

        c.drawColor(p.accentField);
        if (p.accentOff) p.frame(c);

        // Top: city and when the data was fetched.
        String updated = data.optString("updated");
        float updatedW = p.measure(updated, 11, p.regular);
        p.text(c, data.optString("city"), pad, pad + 11, 13, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, inner - updatedW - 8);
        p.text(c, updated, p.w - pad, pad + 11, 11, p.regular, WidgetPainter.withAlpha(WidgetPainter.WHITE, 0.75f), Paint.Align.RIGHT, updatedW + 1);

        // Bottom block, from the bottom up.
        float y = p.h - pad;
        String delta = now.isNull("delta") ? null : now.optString("delta");
        if (delta != null && p.h >= 140) {
            p.text(c, delta, pad, y, 12, p.bold, WidgetPainter.withAlpha(WidgetPainter.WHITE, 0.8f), Paint.Align.LEFT, inner);
            y -= 17;
        }
        String range = "H " + now.optString("hi") + "  L " + now.optString("lo");
        if (p.w >= 150) range += "  ·  " + now.optString("rainLabel", "Rain " + now.optString("rain"));
        p.text(c, range, pad, y, 12, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, inner);
        y -= 18;
        p.text(c, now.optString("cond"), pad, y, 15, p.bold, WidgetPainter.WHITE, Paint.Align.LEFT, inner);
        y -= 8;

        // The big temperature fills the space that is left, like the hero.
        String temp = now.optString("temp");
        float room = y - (pad + 18);
        float size = Math.max(24, Math.min(room * 1.15f, 150));
        float width = p.measure(temp, size, p.heavy);
        if (width > inner) size = size * inner / width;
        p.style(size, p.heavy, WidgetPainter.WHITE, Paint.Align.LEFT).setLetterSpacing(-0.04f);
        c.drawText(temp, pad - size * 0.04f, y, p.text);
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
