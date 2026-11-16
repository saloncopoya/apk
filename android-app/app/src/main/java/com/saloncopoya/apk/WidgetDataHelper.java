package com.saloncopoya.apk;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.util.Log;

import org.json.JSONArray;

public class WidgetDataHelper {

    private static final String TAG = "WidgetDataHelper";
    public static final String PREFS = "widget_data";
    public static final String KEY_SCHEDULE = "schedule_today";
    public static final String KEY_PUSHED   = "pushed_once";

    /** Guarda el JSON y fuerza refresh COMPLETO del widget (header + lista). */
    public static void updateSchedule(Context ctx, String json) {
        try {
            String clean = (json == null || json.trim().isEmpty()) ? "[]" : json;
            int n = 0;
            try { n = new JSONArray(clean).length(); } catch (Exception ignored) {}

            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
               .edit()
               .putString(KEY_SCHEDULE, clean)
               .putBoolean(KEY_PUSHED, true)
               .commit();

            Log.d(TAG, "updateSchedule OK · items=" + n + " · json=" + clean.substring(0, Math.min(200, clean.length())));

            // 🔑 Forzar refresco COMPLETO del widget (no solo la lista)
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            ComponentName cn = new ComponentName(ctx, ListAppWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            if (ids != null && ids.length > 0) {
                ListAppWidgetProvider.renderWidgets(ctx, mgr, ids);
            }
        } catch (Exception e) {
            Log.e(TAG, "updateSchedule err", e);
        }
    }

    public static String readSchedule(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_SCHEDULE, "[]");
    }

    public static boolean hasBeenPushed(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(KEY_PUSHED, false);
    }
}
