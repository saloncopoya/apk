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
import org.json.JSONObject;

public class ListAppWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "ListAppWidgetProvider";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            try {
                RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_schedule);
                // 1. Configurar el header y el botón de refresh
                Intent openIntent = new Intent(context, MainActivity.class);
                PendingIntent openPi = PendingIntent.getActivity(context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                rv.setOnClickPendingIntent(R.id.widget_header, openPi);

                Intent refreshIntent = new Intent(context, ListAppWidgetProvider.class);
                refreshIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                PendingIntent refreshPi = PendingIntent.getBroadcast(context, 1, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                rv.setOnClickPendingIntent(R.id.widget_refresh, refreshPi);

                // 2. Construir los items de la colección
                RemoteViews.RemoteCollectionItems.Builder builder = new RemoteViews.RemoteCollectionItems.Builder();
                String json = WidgetDataHelper.readSchedule(context);
                JSONArray arr = new JSONArray(json);
                
                if (arr.length() == 0) {
                    rv.setTextViewText(R.id.widget_header_text, WidgetDataHelper.hasBeenPushed(context) ? "📅 HOY · sin programados" : "📅 Abre la app para cargar");
                } else {
                    rv.setTextViewText(R.id.widget_header_text, "📅 HOY · " + arr.length() + " programados");
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject o = arr.getJSONObject(i);
                        String pid = o.optString("id");
                        String nombre = o.optString("n");
                        String hora = o.optString("h");
                        String colonia = o.optString("c");

                        RemoteViews itemView = new RemoteViews(context.getPackageName(), R.layout.widget_schedule_item);
                        itemView.setTextViewText(R.id.item_name, nombre);
                        String sub = (hora.isEmpty() ? "" : "⏰ " + hora) + (colonia.isEmpty() ? "" : (hora.isEmpty() ? "" : " · ") + colonia);
                        itemView.setTextViewText(R.id.item_sub, sub);

                        // Click en la fila -> abrir app
                        Intent fillIn = new Intent();
                        fillIn.putExtra("pid", pid);
                        itemView.setOnClickFillInIntent(R.id.item_root, fillIn);
                        
                        // Click en el botón de llamada
                        String tel = o.optString("tel");
                        if (!tel.isEmpty()) {
                            Intent dial = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + tel));
                            PendingIntent dialPi = PendingIntent.getActivity(context, ("dial_" + pid).hashCode(), dial, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                            itemView.setOnClickPendingIntent(R.id.item_phone_btn, dialPi);
                        }

                        builder.addItem(i, itemView);
                    }
                }

                // 3. Establecer la colección en el widget
                rv.setRemoteAdapter(R.id.schedule_list, builder.build());

                // 4. Template para el click de las filas
                Intent templateIntent = new Intent(context, MainActivity.class);
                templateIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
                PendingIntent templatePi = PendingIntent.getActivity(context, 2, templateIntent, flags);
                rv.setPendingIntentTemplate(R.id.schedule_list, templatePi);

                mgr.updateAppWidget(id, rv);
            } catch (Exception e) {
                android.util.Log.e(TAG, "Error renderizando widget", e);
            }
        }
    }
}
