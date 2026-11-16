package com.saloncopoya.apk;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.app.PendingIntent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class ScheduleWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new ScheduleFactory(getApplicationContext());
    }

    static class ScheduleFactory implements RemoteViewsService.RemoteViewsFactory {
        private final Context ctx;
        private final List<Patient> patients = new ArrayList<>();

        static class Patient {
            String id, nombre, colonia, hora, tel;
        }

        ScheduleFactory(Context ctx) { this.ctx = ctx; }

        @Override public void onCreate() {}
        @Override public void onDestroy() {}

        @Override
        public void onDataSetChanged() {
            patients.clear();
            try {
                String json = WidgetDataHelper.readSchedule(ctx);
                JSONArray arr = new JSONArray(json);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    Patient p = new Patient();
                    p.id      = o.optString("id", "");
                    p.nombre  = o.optString("n", "");
                    p.colonia = o.optString("c", "");
                    p.hora    = o.optString("h", "");
                    p.tel     = o.optString("tel", "");
                    if (!p.id.isEmpty() && !p.nombre.isEmpty()) patients.add(p);
                }
            } catch (Exception e) { e.printStackTrace(); }
        }

        @Override public int getCount() { return patients.size(); }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int p) { return p; }
        @Override public boolean hasStableIds() { return false; }
        @Override public RemoteViews getLoadingView() { return null; }

        @Override
        public RemoteViews getViewAt(int pos) {
            if (pos < 0 || pos >= patients.size()) return null;
            Patient p = patients.get(pos);

            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_schedule_item);
            rv.setTextViewText(R.id.item_name, p.nombre);

            String sub = "";
            if (p.hora != null && !p.hora.isEmpty()) sub += "⏰ " + p.hora;
            if (p.colonia != null && !p.colonia.isEmpty()) {
                if (!sub.isEmpty()) sub += " · ";
                sub += p.colonia;
            }
            if (sub.isEmpty()) sub = "—";
            rv.setTextViewText(R.id.item_sub, sub);

            // Click en toda la fila → abrir app con pid
            Intent fill = new Intent();
            fill.putExtra("pid", p.id);
            rv.setOnClickFillInIntent(R.id.item_root, fill);

            // Botón 📞 → dial directo
            if (p.tel != null && !p.tel.isEmpty()) {
                rv.setViewVisibility(R.id.item_phone_btn, View.VISIBLE);
                Intent dial = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + p.tel));
                PendingIntent pi = PendingIntent.getActivity(
                        ctx,
                        ("dial_" + p.id).hashCode(),
                        dial,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                rv.setOnClickPendingIntent(R.id.item_phone_btn, pi);
            } else {
                rv.setViewVisibility(R.id.item_phone_btn, View.GONE);
            }

            return rv;
        }
    }
}
