package com.saloncopoya.apk;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

public class WidgetDataHelper {

    public static final String PREFS = "widget_data";
    public static final String KEY_SCHEDULE = "schedule_today";

    /** Guarda el JSON y refresca todos los widgets en pantalla. */
    public static void updateSchedule(Context ctx, String json) {
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
               .edit()
               .putString(KEY_SCHEDULE, json == null ? "[]" : json)
               .apply();

            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(
                    new ComponentName(ctx, ListAppWidgetProvider.class));
            for (int id : ids) {
                mgr.notifyAppWidgetViewDataChanged(id, R.id.schedule_list);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static String readSchedule(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_SCHEDULE, "[]");
    }
}
