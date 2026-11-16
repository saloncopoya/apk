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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
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
    private LinearLayout panelContent;
    private WebView floatingWebView;
    private View resizeGrip;

    private boolean webViewCreated = false;
    private boolean isExpanded = false;
    private boolean resizeMode = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "═══ onCreate ═══ SDK=" + Build.VERSION.SDK_INT);
        toast("🔄 Iniciando servicio...");

        try {
            crearCanalNotificacion();
        } catch (Exception e) {
            Log.e(TAG, "crearCanal falló", e);
        }
        Notification notif = construirNotificacion();

        boolean fgOk = false;
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notif,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
            fgOk = true;
            Log.i(TAG, "startForeground OK");
        } catch (Throwable t1) {
            Log.e(TAG, "startForeground tipo falló", t1);
            try {
                startForeground(NOTIFICATION_ID, notif);
                fgOk = true;
                Log.i(TAG, "startForeground OK (2 args)");
            } catch (Throwable t2) {
                Log.e(TAG, "startForeground 2-args falló", t2);
            }
        }

        if (!fgOk) {
            toast("❌ ERROR: no pudo entrar a foreground");
            stopSelf();
            return;
        }

        try {
            mostrarVentanaFlotante();
        } catch (Throwable t) {
            Log.e(TAG, "montar overlay falló", t);
            toast("❌ ERROR: " + t.getClass().getSimpleName());
            stopSelf();
        }
    }

    private void mostrarVentanaFlotante() {
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) {
            toast("❌ WindowManager null");
            return;
        }

        floatingView = LayoutInflater.from(this).inflate(R.layout.floating_window, null);
        collapsedRoot = floatingView.findViewById(R.id.collapsedRoot);
        expandedRoot  = floatingView.findViewById(R.id.expandedRoot);
        panelContent  = floatingView.findViewById(R.id.panelContent);
        resizeGrip    = floatingView.findViewById(R.id.resizeGrip);

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

        // ── Burbuja: click expande, drag mueve ──
        collapsedRoot.setOnClickListener(v -> setExpanded(true));

        // ── Header: collapse / close / resize toggle ──
        floatingView.findViewById(R.id.btnClose).setOnClickListener(v -> stopSelf());
        floatingView.findViewById(R.id.btnCollapse).setOnClickListener(v -> setExpanded(false));

        floatingView.findViewById(R.id.btnResizeToggle).setOnClickListener(v -> {
            resizeMode = !resizeMode;
            resizeGrip.setVisibility(resizeMode ? View.VISIBLE : View.GONE);
            toast(resizeMode
                    ? "⤢ Ajustar tamaño: ON — arrastra ⇲"
                    : "⤢ Ajustar tamaño: OFF");
        });

        // ── Drag para MOVER el panel (header + burbuja) ──
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
                            try { windowManager.updateViewLayout(floatingView, params); }
                            catch (Throwable t) { Log.e(TAG, "update drag err", t); }
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

        // ── Drag del GRIP para REDIMENSIONAR ──
        setupResize();

        // ── addView ──
        try {
            windowManager.addView(floatingView, params);
            Log.i(TAG, "addView OK ✓");
            toast("✅ Ventana flotante activa");
        } catch (Throwable t) {
            Log.e(TAG, "addView falló", t);
            toast("❌ addView: " + t.getClass().getSimpleName());
            stopSelf();
        }
    }

    /** Configura el grip de resize (esquina inferior-derecha). */
    private void setupResize() {
        final float density = getResources().getDisplayMetrics().density;
        final int minW = (int)(180 * density);
        final int minH = (int)(150 * density);
        final int maxW = (int)(getResources().getDisplayMetrics().widthPixels * 0.95f);
        final int maxH = (int)(getResources().getDisplayMetrics().heightPixels * 0.85f);

        resizeGrip.setOnTouchListener(new View.OnTouchListener() {
            private int startWidth, startHeight;
            private float startX, startY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        ViewGroup.LayoutParams lp = panelContent.getLayoutParams();
                        startWidth = lp.width;
                        if (floatingWebView != null) {
                            startHeight = floatingWebView.getLayoutParams().height;
                        } else {
                            startHeight = (int)(380 * density);
                        }
                        startX = event.getRawX();
                        startY = event.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        int newW = startWidth + (int)(event.getRawX() - startX);
                        int newH = startHeight + (int)(event.getRawY() - startY);
                        newW = Math.max(minW, Math.min(maxW, newW));
                        newH = Math.max(minH, Math.min(maxH, newH));

                        ViewGroup.LayoutParams lpW = panelContent.getLayoutParams();
                        lpW.width = newW;
                        panelContent.setLayoutParams(lpW);

                        if (floatingWebView != null) {
                            ViewGroup.LayoutParams lpH = floatingWebView.getLayoutParams();
                            lpH.height = newH;
                            floatingWebView.setLayoutParams(lpH);
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        return true;
                }
                return false;
            }
        });
    }

    private void setExpanded(boolean expand) {
        isExpanded = expand;
        if (collapsedRoot != null) collapsedRoot.setVisibility(expand ? View.GONE : View.VISIBLE);
        if (expandedRoot  != null) expandedRoot.setVisibility(expand ? View.VISIBLE : View.GONE);

        if (expand && !webViewCreated) {
            crearWebViewDiferido();
        }

        // Al colapsar: salir del modo resize
        if (!expand) {
            resizeMode = false;
            if (resizeGrip != null) resizeGrip.setVisibility(View.GONE);
        }

        if (expand) {
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        } else {
            params.flags |=  WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        }
        if (windowManager != null && floatingView != null) {
            try { windowManager.updateViewLayout(floatingView, params); }
            catch (Throwable t) { Log.e(TAG, "update expand err", t); }
        }
    }

    private void crearWebViewDiferido() {
        webViewCreated = true;
        try {
            floatingWebView = floatingView.findViewById(R.id.floatingWebView);
            if (floatingWebView == null) {
                Log.e(TAG, "WebView view null");
                return;
            }
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
            Log.i(TAG, "WebView cargado");
        } catch (Throwable t) {
            Log.e(TAG, "WebView falló", t);
            toast("⚠ WebView no cargó");
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

    private void toast(final String msg) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show();
            } catch (Throwable ignored) {}
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "onDestroy");
        try { stopForeground(true); } catch (Throwable ignored) {}
        if (floatingWebView != null) {
            try {
                floatingWebView.loadUrl("about:blank");
                floatingWebView.destroy();
            } catch (Throwable ignored) {}
            floatingWebView = null;
        }
        if (floatingView != null && windowManager != null) {
            try { windowManager.removeView(floatingView); } catch (Throwable ignored) {}
        }
        floatingView = null;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
