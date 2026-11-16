package com.saloncopoya.apk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;
import android.util.Log;

import org.json.JSONArray;

public class ListAppWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "ListAppWidgetProvider";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        renderWidgets(context, mgr, ids);
    }

    /** 🔑 Método estático para que WidgetDataHelper lo pueda llamar sin instanciar. */
    public static void renderWidgets(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            try {
                RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_schedule);

                // Header → abre la app
                Intent openIntent = new Intent(context, MainActivity.class);
                openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent openPi = PendingIntent.getActivity(
                        context, 0, openIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                rv.setOnClickPendingIntent(R.id.widget_header, openPi);

                // Botón 🔄 → onUpdate forzado
                Intent refreshIntent = new Intent(context, ListAppWidgetProvider.class);
                refreshIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                PendingIntent refreshPi = PendingIntent.getBroadcast(
                        context, 1, refreshIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                rv.setOnClickPendingIntent(R.id.widget_refresh, refreshPi);

                // Adapter del ListView
                Intent svcIntent = new Intent(context, ScheduleWidgetService.class);
                svcIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
                svcIntent.setData(Uri.parse(svcIntent.toUri(Intent.URI_INTENT_SCHEME)));
                rv.setRemoteAdapter(R.id.schedule_list, svcIntent);
                rv.setEmptyView(R.id.schedule_list, R.id.widget_empty);

                // Template de click de filas
                Intent templateIntent = new Intent(context, MainActivity.class);
                templateIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
                PendingIntent templatePi = PendingIntent.getActivity(context, 2, templateIntent, flags);
                rv.setPendingIntentTemplate(R.id.schedule_list, templatePi);

                // Header dinámico
                actualizarHeader(context, rv);

                mgr.updateAppWidget(id, rv);
                mgr.notifyAppWidgetViewDataChanged(id, R.id.schedule_list);

                Log.d(TAG, "renderWidgets OK · appWidgetId=" + id);
            } catch (Exception e) {
                Log.e(TAG, "renderWidgets err id=" + id, e);
            }
        }
    }

    private static void actualizarHeader(Context ctx, RemoteViews rv) {
        try {
            // 1. ¿Nunca llegó push del JS?
            if (!WidgetDataHelper.hasBeenPushed(ctx)) {
                rv.setTextViewText(R.id.widget_header_text, "📅 Abre la app para cargar");
                return;
            }
            // 2. ¿Llegó push pero 0 programados hoy?
            String json = WidgetDataHelper.readSchedule(ctx);
            int n = 0;
            try { n = new JSONArray(json).length(); } catch (Exception ignored) {}

            if (n == 0) {
                rv.setTextViewText(R.id.widget_header_text, "📅 HOY · sin programados");
            } else {
                rv.setTextViewText(R.id.widget_header_text,
                        "📅 HOY · " + n + (n == 1 ? " programado" : " programados"));
            }
        } catch (Exception e) {
            rv.setTextViewText(R.id.widget_header_text, "📅 HOY");
        }
    }
}
