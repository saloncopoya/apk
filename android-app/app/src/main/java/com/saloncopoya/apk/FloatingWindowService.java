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
import android.webkit.JavascriptInterface;
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
    private long lastViewportUpdate = 0;
    private static final long VIEWPORT_THROTTLE_MS = 100;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "═══ onCreate ═══ SDK=" + Build.VERSION.SDK_INT);
        toast("🔄 Iniciando servicio...");

        try { crearCanalNotificacion(); } catch (Exception e) { Log.e(TAG, "canal falló", e); }
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
        } catch (Throwable t1) {
            try { startForeground(NOTIFICATION_ID, notif); fgOk = true; } catch (Throwable t2) {}
        }

        if (!fgOk) { toast("❌ ERROR: no pudo entrar a foreground"); stopSelf(); return; }

        try { mostrarVentanaFlotante(); }
        catch (Throwable t) { Log.e(TAG, "montar overlay falló", t); toast("❌ " + t.getClass().getSimpleName()); stopSelf(); }
    }

    private void mostrarVentanaFlotante() {
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) { toast("❌ WindowManager null"); return; }

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

        collapsedRoot.setOnClickListener(v -> setExpanded(true));
        floatingView.findViewById(R.id.btnClose).setOnClickListener(v -> stopSelf());
        floatingView.findViewById(R.id.btnCollapse).setOnClickListener(v -> setExpanded(false));


        // 🆕 Botón COPIAR TEXTO
floatingView.findViewById(R.id.btnCopyText).setOnClickListener(v -> {
    if (CopyTextAccessibilityService.getInstance() == null) {
        Toast.makeText(this,
            "⚠️ Activa el servicio en: Ajustes → Accesibilidad → Salon Copoya 2026",
            Toast.LENGTH_LONG).show();
        // Abrir ajustes de accesibilidad para que lo active
        try {
            Intent acc = new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS);
            acc.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(acc);
        } catch (Exception e) {
            Log.e(TAG, "No se pudo abrir accesibilidad", e);
        }
        return;
    }
    String text = CopyTextAccessibilityService.getInstance().copyAllTextFromScreen();
    if (text != null && !text.trim().isEmpty()) {
        Toast.makeText(this,
            "✅ Texto copiado (" + text.length() + " caracteres)",
            Toast.LENGTH_SHORT).show();
    } else {
        Toast.makeText(this,
            "⚠️ No se encontró texto en la pantalla",
            Toast.LENGTH_SHORT).show();
    }
});
        
        floatingView.findViewById(R.id.btnResizeToggle).setOnClickListener(v -> {
            resizeMode = !resizeMode;
            resizeGrip.setVisibility(resizeMode ? View.VISIBLE : View.GONE);
            toast(resizeMode ? "⤢ Resize ON" : "⤢ Resize OFF");
        });

        View.OnTouchListener dragListener = new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isDragging = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x; initialY = params.y;
                        initialTouchX = event.getRawX(); initialTouchY = event.getRawY();
                        isDragging = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - initialTouchX;
                        float dy = event.getRawY() - initialTouchY;
                        if (!isDragging && (Math.abs(dx) > 10f || Math.abs(dy) > 10f)) isDragging = true;
                        if (isDragging) {
                            params.x = initialX + (int) dx;
                            params.y = initialY + (int) dy;
                            try { windowManager.updateViewLayout(floatingView, params); } catch (Throwable t) {}
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

        setupResize();

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

    /** ═══ RESIZE con viewport responsive ═══ */
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
                        startHeight = floatingWebView != null
                                ? floatingWebView.getLayoutParams().height
                                : (int)(380 * density);
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
                            // 🆕 Forzar re-layout inmediato
                            floatingWebView.requestLayout();
                        }

                        // 🆕 Actualizar viewport (throttled)
                        long now = System.currentTimeMillis();
                        if (now - lastViewportUpdate > VIEWPORT_THROTTLE_MS) {
                            lastViewportUpdate = now;
                            updateWebViewViewport();
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 🆕 Actualización final (sin throttle)
                        updateWebViewViewport();
                        return true;
                }
                return false;
            }
        });
    }

    /**
     * 🔧 LA CLAVE DEL FIX: inyecta un <meta viewport> con el ancho EXACTO
     *    en CSS px del WebView. Sin esto, el page usa device-width = ancho
     *    del TELÉFONO, no del WebView, y se corta al hacer la ventana chica.
     */
    private void updateWebViewViewport() {
        if (floatingWebView == null) return;
        final WebView wv = floatingWebView;
        wv.post(() -> {
            try {
                int wPx = wv.getWidth();
                if (wPx <= 0) return;
                float density = getResources().getDisplayMetrics().density;
                int cssWidth = Math.max(200, Math.round(wPx / density));

                String js = "(function(){" +
                        "var m=document.querySelector('meta[name=\"viewport\"]');" +
                        "if(!m){m=document.createElement('meta');m.setAttribute('name','viewport');document.head.appendChild(m);}" +
                        "m.setAttribute('content','width=" + cssWidth + ", initial-scale=1.0, user-scalable=yes');" +
                        "})()";
                wv.evaluateJavascript(js, null);
            } catch (Throwable t) {
                Log.e(TAG, "viewport inject err", t);
            }
        });
    }

    private void setExpanded(boolean expand) {
        isExpanded = expand;
        if (collapsedRoot != null) collapsedRoot.setVisibility(expand ? View.GONE : View.VISIBLE);
        if (expandedRoot  != null) expandedRoot.setVisibility(expand ? View.VISIBLE : View.GONE);

        if (expand && !webViewCreated) crearWebViewDiferido();

        if (!expand) {
            resizeMode = false;
            if (resizeGrip != null) resizeGrip.setVisibility(View.GONE);
        }

        if (expand) params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        else        params.flags |=  WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;

        if (windowManager != null && floatingView != null) {
            try { windowManager.updateViewLayout(floatingView, params); } catch (Throwable t) {}
        }

        // 🆕 Al expandir, ajustar viewport al tamaño actual
        if (expand) {
            floatingView.postDelayed(this::updateWebViewViewport, 300);
        }
    }

    private void crearWebViewDiferido() {
        webViewCreated = true;
        try {
            floatingWebView = floatingView.findViewById(R.id.floatingWebView);
            if (floatingWebView == null) return;

            WebSettings s = floatingWebView.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setDatabaseEnabled(true);
            s.setAllowFileAccess(true);
            s.setAllowContentAccess(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            s.setUseWideViewPort(true);            // respeta meta viewport
            s.setLoadWithOverviewMode(false);       // 🆕 NO auto-zoom (controlamos con JS)
            s.setUserAgentString("Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");

            // 🆕 JS bridge para empujar datos al widget
            floatingWebView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void updateSchedule(String json) {
                    WidgetDataHelper.updateSchedule(FloatingWindowService.this, json);
                }
            }, "WidgetBridge");

            floatingWebView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    // 🆕 Ajustar viewport cuando la página termina de cargar
                    view.postDelayed(FloatingWindowService.this::updateWebViewViewport, 500);
                }
            });
            floatingWebView.loadUrl(APP_URL);
            Log.i(TAG, "WebView cargado");
        } catch (Throwable t) {
            Log.e(TAG, "WebView falló", t);
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
            try { Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show(); } catch (Throwable ignored) {}
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { stopForeground(true); } catch (Throwable ignored) {}
        if (floatingWebView != null) {
            try { floatingWebView.loadUrl("about:blank"); floatingWebView.destroy(); } catch (Throwable ignored) {}
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
