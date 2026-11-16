package com.saloncopoya.apk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.NotificationCompat;

public class FloatingWindowService extends Service {
    private static final String TAG = "FloatingWindowService";
    private static final String CHANNEL_ID = "floating_window_channel";
    private static final int NOTIFICATION_ID = 1001;

    private WindowManager windowManager;
    private View floatingView;
    private WindowManager.LayoutParams params;
    private WebView webView;
    private boolean isSmall = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "onCreate: servicio iniciado, SDK=" + Build.VERSION.SDK_INT);

        // 1. Crear canal de notificación (necesario antes de startForeground)
        crearCanalNotificacion();
        Notification notification = construirNotificacion();

        // 2. Entrar en foreground — LA CLAVE: SPECIAL_USE solo existe desde API 34
        boolean fgOk = false;
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                // Android 14+: usar tipo explícito SPECIAL_USE
                startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
                Log.i(TAG, "startForeground OK con SPECIAL_USE (API 34+)");
            } else {
                // Android 13 y anteriores: el tipo SPECIAL_USE NO existe
                // → usar la versión de 2 argumentos (usa lo declarado en manifest)
                startForeground(NOTIFICATION_ID, notification);
                Log.i(TAG, "startForeground OK con 2-args (API < 34)");
            }
            fgOk = true;
        } catch (Exception e) {
            Log.e(TAG, "startForeground falló con tipo explícito, reintentando 2-args", e);
            try {
                startForeground(NOTIFICATION_ID, notification);
                fgOk = true;
                Log.i(TAG, "startForeground OK en fallback 2-args");
            } catch (Exception e2) {
                Log.e(TAG, "startForeground fallback también falló", e2);
            }
        }

        if (!fgOk) {
            Log.e(TAG, "No se pudo entrar en foreground, el sistema matará el servicio. Abortando.");
            stopSelf();
            return;
        }

        // 3. Ahora sí, montar la ventana flotante
        try {
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            floatingView = LayoutInflater.from(this).inflate(R.layout.floating_window, null);

            int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                    WindowManager.LayoutParams.TYPE_PHONE;

            params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT);

            params.gravity = Gravity.TOP | Gravity.START;
            params.x = 50;
            params.y = 100;
            params.width = 800;
            params.height = 1200;

            webView = floatingView.findViewById(R.id.floating_webview);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setUserAgentString(
                    "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
            webView.setWebViewClient(new WebViewClient());
            webView.loadUrl("https://255-255-255-0x7f000001.pages.dev/");

            floatingView.findViewById(R.id.btn_close).setOnClickListener(v -> stopSelf());

            floatingView.findViewById(R.id.btn_resize).setOnClickListener(v -> {
                isSmall = !isSmall;
                params.width = isSmall ? 600 : 800;
                params.height = isSmall ? 800 : 1200;
                windowManager.updateViewLayout(floatingView, params);
            });

            View dragHandle = floatingView.findViewById(R.id.drag_handle);
            dragHandle.setOnTouchListener(new View.OnTouchListener() {
                private int initialX, initialY;
                private float initialTouchX, initialTouchY;

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            initialX = params.x;
                            initialY = params.y;
                            initialTouchX = event.getRawX();
                            initialTouchY = event.getRawY();
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            params.x = initialX + (int) (event.getRawX() - initialTouchX);
                            params.y = initialY + (int) (event.getRawY() - initialTouchY);
                            windowManager.updateViewLayout(floatingView, params);
                            return true;
                    }
                    return false;
                }
            });

            windowManager.addView(floatingView, params);
            Log.i(TAG, "Ventana flotante añadida al WindowManager");

        } catch (Exception e) {
            Log.e(TAG, "Error al añadir la ventana flotante (¿falta permiso SYSTEM_ALERT_WINDOW?)", e);
            stopSelf();
        }
    }

    private void crearCanalNotificacion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Ventana Flotante",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notificación del servicio de ventana flotante");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification construirNotificacion() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Ventana Flotante Activa")
                .setContentText("La app se muestra sobre otras aplicaciones")
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "onDestroy: cerrando servicio");
        if (floatingView != null && windowManager != null) {
            try {
                windowManager.removeView(floatingView);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
