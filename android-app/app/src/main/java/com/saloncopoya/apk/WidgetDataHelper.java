package com.saloncopoya.apk;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;

public class WidgetDataHelper {
    private static final String TAG = "WidgetDataHelper";
    private static final String PREFS = "widget_data";
    private static final String KEY_SCHEDULE = "schedule_today";
    private static final String KEY_PUSHED   = "pushed_once";

    public static void updateSchedule(Context ctx, String json) {
        try {
            String clean = (json == null || json.trim().isEmpty()) ? "[]" : json;
            int n = new JSONArray(clean).length();
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            sp.edit().putString(KEY_SCHEDULE, clean).putBoolean(KEY_PUSHED, true).commit();

            Log.d(TAG, ">>> PUSH RECIBIDO items=" + n);

            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            ComponentName cn = new ComponentName(ctx, ListAppWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            if (ids != null && ids.length > 0) {
                // Forzar onUpdate para que se reconstruya la colección
                Intent intent = new Intent(ctx, ListAppWidgetProvider.class);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                ctx.sendBroadcast(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "updateSchedule err", e);
        }
    }

    public static String readSchedule(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SCHEDULE, "[]");
    }

    public static boolean hasBeenPushed(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_PUSHED, false);
    }
}
