package com.saloncopoya.apk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
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
import android.widget.Toast;
import androidx.core.app.NotificationCompat;

public class FloatingWindowService extends Service {

    private static final String TAG = "FloatingWindowService";
    private static final String CHANNEL_ID = "floating_window_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final String APP_URL = "https://255-255-255-0x7f000001.pages.dev/";

    private WindowManager windowManager;
    private View floatingView;
    private WindowManager.LayoutParams params;
    private View collapsedRoot;
    private View expandedRoot;
    private WebView floatingWebView;
    private boolean isExpanded = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "onCreate - SDK=" + Build.VERSION.SDK_INT);

        crearCanalNotificacion();
        Notification notif = construirNotificacion();

        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notif,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
            Log.i(TAG, "startForeground OK");
        } catch (Exception e) {
            Log.e(TAG, "startForeground falló, reintentando 2-args", e);
            try {
                startForeground(NOTIFICATION_ID, notif);
            } catch (Exception e2) {
                Log.e(TAG, "startForeground falló definitivamente", e2);
                stopSelf();
                return;
            }
        }

        try {
            mostrarVentanaFlotante();
        } catch (Exception e) {
            Log.e(TAG, "Error al montar overlay", e);
            stopSelf();
        }
    }

    private void mostrarVentanaFlotante() {
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);

        floatingView    = LayoutInflater.from(this).inflate(R.layout.floating_window, null);
        collapsedRoot   = floatingView.findViewById(R.id.collapsedRoot);
        expandedRoot    = floatingView.findViewById(R.id.expandedRoot);
        floatingWebView = floatingView.findViewById(R.id.floatingWebView);

        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 80;
        params.y = 200;

        collapsedRoot.setOnClickListener(v -> setExpanded(true));

        floatingView.findViewById(R.id.btnClose).setOnClickListener(v -> stopSelf());
        floatingView.findViewById(R.id.btnCollapse).setOnClickListener(v -> setExpanded(false));

        floatingView.findViewById(R.id.btnNotify).setOnClickListener(v -> {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("Notificación de prueba")
                    .setContentText("Funciona ✅")
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .build();
            nm.notify(2001, n);
        });

        floatingView.findViewById(R.id.btnRefresh).setOnClickListener(v -> {
            if (floatingWebView != null) floatingWebView.reload();
        });

        floatingView.findViewById(R.id.btnOpenApp).setOnClickListener(v -> {
            Intent i = new Intent(this, MainActivity.class);
            i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(i);
        });

        View.OnTouchListener dragListener = new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isDragging = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        isDragging = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - initialTouchX;
                        float dy = event.getRawY() - initialTouchY;
                        if (!isDragging && (Math.abs(dx) > 10f || Math.abs(dy) > 10f)) {
                            isDragging = true;
                        }
                        if (isDragging) {
                            params.x = initialX + (int) dx;
                            params.y = initialY + (int) dy;
                            windowManager.updateViewLayout(floatingView, params);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!isDragging) v.performClick();
                        isDragging = false;
                        return true;
                }
                return false;
            }
        };
        collapsedRoot.setOnTouchListener(dragListener);
        floatingView.findViewById(R.id.dragHandle).setOnTouchListener(dragListener);

        WebSettings s = floatingWebView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setUserAgentString("Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
        floatingWebView.setWebViewClient(new WebViewClient());
        floatingWebView.loadUrl(APP_URL);

        windowManager.addView(floatingView, params);
        Log.i(TAG, "Overlay añadido ✓");
        Toast.makeText(this, "✅ Ventana flotante activa", Toast.LENGTH_SHORT).show();
    }

    private void setExpanded(boolean expand) {
        isExpanded = expand;
        if (collapsedRoot != null) collapsedRoot.setVisibility(expand ? View.GONE : View.VISIBLE);
        if (expandedRoot  != null) expandedRoot.setVisibility(expand ? View.VISIBLE : View.GONE);

        if (expand) {
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        } else {
            params.flags |=  WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        }
        if (windowManager != null && floatingView != null) {
            windowManager.updateViewLayout(floatingView, params);
        }
    }

    private void crearCanalNotificacion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Ventana Flotante", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Servicio de ventana flotante");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification construirNotificacion() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Ventana Flotante Activa")
                .setContentText("Toca para volver a la app")
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "onDestroy");
        try { stopForeground(true); } catch (Exception ignored) {}
        if (floatingWebView != null) {
            try { floatingWebView.loadUrl("about:blank"); floatingWebView.destroy(); } catch (Exception ignored) {}
            floatingWebView = null;
        }
        if (floatingView != null && windowManager != null) {
            try { windowManager.removeView(floatingView); } catch (Exception ignored) {}
        }
        floatingView = null;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
