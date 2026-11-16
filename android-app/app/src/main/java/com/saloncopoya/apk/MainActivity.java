package com.saloncopoya.apk;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE = 1001;
    
    // ⚠️ CAMBIA ESTO POR TU DOMINIO REAL DE CLOUDFLARE
    private static final String DOMINIO_REAL = "https://255-255-255-0x7f000001.pages.dev"; 

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        setContentView(webView);

        // 1. Pedir permisos de GPS y Cámara al iniciar
        pedirPermisos();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // Para Firebase
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        
        // 2. Habilitar Cookies (CRUCIAL para el login de Firebase)
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // 3. Habilitar Service Workers (Para tu modo Offline / sw.js)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            settings.setServiceWorkerEnabled(true);
        }
        
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // 4. Permitir contenido mixto (por si usas HTTP en imágenes o CDNs)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                
                // 🔥 TRUCO MÁGICO: Interceptar llamadas a /api/ y enviarlas a Cloudflare
                if (url.getHost().equals("appassets.androidplatform.net") && url.getPath().startsWith("/api/")) {
                    try {
                        URL apiUrl = new URL(DOMINIO_REAL + url.getPath() + (url.getQuery() != null ? "?" + url.getQuery() : ""));
                        HttpURLConnection conn = (HttpURLConnection) apiUrl.openConnection();
                        conn.setRequestMethod(request.getMethod());
                        // Copiar cabeceras si es necesario
                        InputStream is = conn.getInputStream();
                        return new WebResourceResponse("application/json", "UTF-8", is);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
                
                // Servir archivos locales (index.html, mapas, etc)
                return assetLoader.shouldInterceptRequest(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Si es WhatsApp, correo o teléfono, abrir la app nativa de Android
                if (url.startsWith("whatsapp://") || url.startsWith("mailto:") || url.startsWith("tel:")) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                }
                return false;
            }
        });

        // 5. Configurar GPS y Cámara en la web
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false); // Aceptar GPS automáticamente si ya dimos permisos
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Permitir cámara para el lector de QR
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        // 6. Cargar tu index.html
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
    }

    private void pedirPermisos() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] permisos = {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.CAMERA
            };
            for (String permiso : permisos) {
                if (ContextCompat.checkSelfPermission(this, permiso) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this, permisos, PERMISSION_REQUEST_CODE);
                    break;
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
