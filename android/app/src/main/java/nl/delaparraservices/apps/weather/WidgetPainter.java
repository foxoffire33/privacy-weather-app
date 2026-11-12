package nl.delaparraservices.apps.weather;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;

import org.json.JSONObject;

/**
 * Drawing helpers in the app's style: black, white type, one accent, square corners,
 * 2dp rules. All coordinates are in dp; the canvas is pre-scaled to pixels.
 */
final class WidgetPainter {

    static final int WHITE = 0xFFFFFFFF;
    static final int BLACK = 0xFF000000;
    static final int DIM = 0xFFB4B0B0;
    static final int FAINT = 0xFF7D7979;
    static final int PAST = 0xFFCBC7C7;
    static final int RULE = 0x99F8F4F4;
    static final int TRACK = 0x1FFFFFFF;

    final float w;
    final float h;
    /** Background for accent fields (the hero): the accent, or black when the accent is off. */
    final int accentField;
    /** Accent for marks on black: the accent, or white when the accent is off. */
    final int accentMark;
    final boolean accentOff;

    final Typeface regular = Typeface.create("sans-serif", Typeface.NORMAL);
    final Typeface bold = Typeface.create("sans-serif", Typeface.BOLD);
    final Typeface heavy = Typeface.create("sans-serif-black", Typeface.NORMAL);

    final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    final TextPaint text = new TextPaint(Paint.ANTI_ALIAS_FLAG);

    WidgetPainter(Context context, float w, float h) {
        this.w = w;
        this.h = h;
        SharedPreferences prefs = context.getSharedPreferences(AppIconPlugin.PREFS, Context.MODE_PRIVATE);
        String alias = prefs.getString(AppIconPlugin.KEY_ALIAS, "green");
        int accent;
        try {
            accent = Color.parseColor(prefs.getString(AppIconPlugin.KEY_ACCENT_COLOR, "#178a4a"));
        } catch (IllegalArgumentException e) {
            accent = 0xFF178A4A;
        }
        accentOff = "off".equals(alias) || accent == BLACK;
        accentField = accentOff ? BLACK : accent;
        accentMark = accentOff ? WHITE : accent;
        fill.setStyle(Paint.Style.FILL);
    }

    void rect(Canvas c, float l, float t, float r, float b, int color) {
        fill.setStyle(Paint.Style.FILL);
        fill.setColor(color);
        fill.setPathEffect(null);
        c.drawRect(l, t, r, b, fill);
    }

    /** The app's 2dp outline, used when the accent is off so a black widget still has an edge. */
    void frame(Canvas c) {
        fill.setStyle(Paint.Style.STROKE);
        fill.setStrokeWidth(2);
        fill.setColor(RULE);
        fill.setPathEffect(null);
        c.drawRect(1, 1, w - 1, h - 1, fill);
        fill.setStyle(Paint.Style.FILL);
    }

    TextPaint style(float size, Typeface tf, int color, Paint.Align align) {
        text.setTextSize(size);
        text.setTypeface(tf);
        text.setColor(color);
        text.setTextAlign(align);
        text.setLetterSpacing(0);
        return text;
    }

    /** Draws one line of text, shortened with "…" to fit maxWidth. */
    void text(Canvas c, String s, float x, float baseline, float size, Typeface tf, int color, Paint.Align align, float maxWidth) {
        if (s == null || s.isEmpty() || maxWidth <= 4) return;
        TextPaint p = style(size, tf, color, align);
        CharSequence fit = TextUtils.ellipsize(s, p, maxWidth, TextUtils.TruncateAt.END);
        c.drawText(fit, 0, fit.length(), x, baseline, p);
    }

    /** Small uppercase label, like the app's section kickers. */
    void kicker(Canvas c, String s, float x, float baseline, int color, Paint.Align align, float maxWidth) {
        if (s == null || maxWidth <= 4) return;
        TextPaint p = style(10, bold, color, align);
        p.setLetterSpacing(0.08f);
        CharSequence fit = TextUtils.ellipsize(s.toUpperCase(), p, maxWidth, TextUtils.TruncateAt.END);
        c.drawText(fit, 0, fit.length(), x, baseline, p);
        p.setLetterSpacing(0);
    }

    float measure(String s, float size, Typeface tf) {
        return style(size, tf, WHITE, Paint.Align.LEFT).measureText(s == null ? "" : s);
    }

    /** Shown before the app has loaded weather, or if a snapshot can't be drawn. */
    void empty(Canvas c, String line1, String line2) {
        c.drawColor(BLACK);
        frame(c);
        text(c, line1, w / 2, h / 2 - 2, 13, bold, WHITE, Paint.Align.CENTER, w - 24);
        text(c, line2, w / 2, h / 2 + 15, 12, regular, DIM, Paint.Align.CENTER, w - 24);
    }

    static Float num(JSONObject o, String key) {
        if (o == null || o.isNull(key)) return null;
        double v = o.optDouble(key, Double.NaN);
        return Double.isNaN(v) ? null : (float) v;
    }

    static int withAlpha(int color, float alpha) {
        return (Math.round(alpha * 255) << 24) | (color & 0x00FFFFFF);
    }
}
