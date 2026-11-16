package com.saloncopoya.apk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;

public class ListAppWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_schedule);

            // Header (📅 HOY · N) → click abre app
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openPi = PendingIntent.getActivity(
                    context, 0, openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            rv.setOnClickPendingIntent(R.id.widget_header, openPi);

            // Botón 🔄 → broadcast refresh
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

            // Template para clicks de filas (con fill-in pid)
            Intent templateIntent = new Intent(context, MainActivity.class);
            templateIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent templatePi = PendingIntent.getActivity(context, 2, templateIntent, flags);
            rv.setPendingIntentTemplate(R.id.schedule_list, templatePi);

            // Actualizar contador del header
            actualizarContador(context, rv);

            mgr.updateAppWidget(id, rv);
            mgr.notifyAppWidgetViewDataChanged(id, R.id.schedule_list);
        }
    }

    private void actualizarContador(Context ctx, RemoteViews rv) {
        try {
            String json = WidgetDataHelper.readSchedule(ctx);
            int n = new JSONArray(json).length();
            rv.setTextViewText(R.id.widget_header_text,
                    n > 0 ? "📅 HOY · " + n + " programado" + (n == 1 ? "" : "s")
                          : "📅 HOY · sin programados");
        } catch (Exception e) {
            rv.setTextViewText(R.id.widget_header_text, "📅 HOY");
        }
    }
}
