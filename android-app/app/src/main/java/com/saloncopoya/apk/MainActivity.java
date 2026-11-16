package com.saloncopoya.apk;

import android.Manifest;
import android.annotation.SuppressLint;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE          = 1001;
    private static final int OVERLAY_PERMISSION_REQUEST_CODE  = 1002;
    private static final int NOTIFICATIONS_PERMISSION_REQUEST = 1003;
    private static final String APP_URL = "https://255-255-255-0x7f000001.pages.dev/";

    private String pendingPid = null;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 🆕 Guardar pid pendiente si venimos del widget
        pendingPid = getIntent().getStringExtra("pid");

        if (esIntentFlotante(getIntent())) {
            iniciarVentanaFlotante();
            return;
        }

        webView = new WebView(this);
        setContentView(webView);
        pedirPermisosNormales();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setUserAgentString("Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");

        // 🆕 JS bridge para recibir datos del widget
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void updateSchedule(String json) {
                WidgetDataHelper.updateSchedule(MainActivity.this, json);
            }
        }, "WidgetBridge");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://255-255-255-0x7f000001.pages.dev")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                } catch (Exception e) { return false; }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 🆕 Si venimos del widget con un pid, abrir ese paciente
                if (pendingPid != null) {
                    final String pid = pendingPid;
                    pendingPid = null;
                    view.postDelayed(() -> abrirPacienteDesdeWidget(view, pid), 1800);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        webView.loadUrl(APP_URL);
    }

    /** 🆕 Llama la función JS que abre la ficha del paciente (si existe). */
    private void abrirPacienteDesdeWidget(WebView view, String pid) {
        try {
            String safePid = pid.replace("\\", "\\\\").replace("'", "\\'");
            String js = "(function(){" +
                    "var pid='" + safePid + "';" +
                    "if(typeof window.__openPatientFromWidget==='function'){window.__openPatientFromWidget(pid);}" +
                    "else if(typeof openDetail==='function'){openDetail(pid);}" +
                    "else if(typeof openD==='function'){openD(pid);}" +
                    "})()";
            view.evaluateJavascript(js, null);
        } catch (Exception e) { Log.e(TAG, "abrirPaciente", e); }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        if (esIntentFlotante(intent)) { iniciarVentanaFlotante(); return; }

        // 🆕 Si viene del widget estando la app ya abierta
        String pid = intent.getStringExtra("pid");
        if (pid != null && webView != null) {
            abrirPacienteDesdeWidget(webView, pid);
        }
    }

    private boolean esIntentFlotante(Intent intent) {
        return intent != null && "flotante".equals(intent.getStringExtra("accion"));
    }

    private void iniciarVentanaFlotante() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(i, OVERLAY_PERMISSION_REQUEST_CODE);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATIONS_PERMISSION_REQUEST);
            return;
        }
        arrancarServicioFlotante();
    }

    private void arrancarServicioFlotante() {
        try {
            Intent si = new Intent(this, FloatingWindowService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(si);
            else                                                startService(si);
        } catch (Exception e) {
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> moveTaskToBack(true), 800);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OVERLAY_PERMISSION_REQUEST_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                iniciarVentanaFlotante();
            } else {
                Toast.makeText(this, "Sin permiso de overlay no funciona la burbuja", Toast.LENGTH_LONG).show();
                finish();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATIONS_PERMISSION_REQUEST) {
            arrancarServicioFlotante();
        }
    }

    private void pedirPermisosNormales() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] ps = {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.CAMERA
            };
            for (String p : ps) {
                if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this, ps, PERMISSION_REQUEST_CODE);
                    break;
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
