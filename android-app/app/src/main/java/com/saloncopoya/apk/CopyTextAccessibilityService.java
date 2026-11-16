package com.saloncopoya.apk;

import android.accessibilityservice.AccessibilityService;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.util.Log;

import java.util.List;

public class CopyTextAccessibilityService extends AccessibilityService {

    private static final String TAG = "CopyTextService";
    private static CopyTextAccessibilityService instance;

    public static CopyTextAccessibilityService getInstance() {
        return instance;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        Log.d(TAG, "Servicio de accesibilidad conectado ✓");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.d(TAG, "Servicio de accesibilidad destruido");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No hacer nada. Solo se usa cuando la ventana flotante lo invoca.
    }

    @Override
    public void onInterrupt() {}

    /**
     * 🔑 Copia el texto de TODAS las ventanas visibles EXCEPTO la de esta app.
     * Esto evita copiar el texto de la ventana flotante.
     */
    public String copyAllTextFromScreen() {
        StringBuilder sb = new StringBuilder();
        String myPackage = getPackageName();

        List<AccessibilityWindowInfo> windows = getWindows();
        Log.d(TAG, "Ventanas visibles: " + (windows == null ? 0 : windows.size()));

        if (windows != null) {
            for (AccessibilityWindowInfo w : windows) {
                AccessibilityNodeInfo root = w.getRoot();
                if (root == null) continue;
                CharSequence pkg = root.getPackageName();
                String pkgStr = pkg == null ? "" : pkg.toString();
                Log.d(TAG, "  Ventana detectada: " + pkgStr);

                // 🚫 EXCLUIR nuestra propia app (la ventana flotante)
                if (myPackage.contentEquals(pkgStr)) {
                    Log.d(TAG, "  → Saltando (es mi propia app)");
                    continue;
                }

                extractText(root, sb);
            }
        }

        // Fallback: si no capturamos nada, intentar ventana activa (solo si NO es la propia)
        if (sb.length() == 0) {
            AccessibilityNodeInfo active = getRootInActiveWindow();
            if (active != null) {
                CharSequence pkg = active.getPackageName();
                String pkgStr = pkg == null ? "" : pkg.toString();
                Log.d(TAG, "Fallback ventana activa: " + pkgStr);
                if (!myPackage.contentEquals(pkgStr)) {
                    extractText(active, sb);
                }
            }
        }

        String text = sb.toString().trim();
        if (text.isEmpty()) return null;

        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Texto copiado", text);
        cm.setPrimaryClip(clip);

        Log.d(TAG, "✓ Copiados " + text.length() + " caracteres");
        return text;
    }

    private void extractText(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;

        if (node.getText() != null) {
            String t = node.getText().toString().trim();
            if (!t.isEmpty()) sb.append(t).append('\n');
        }
        if (node.getContentDescription() != null) {
            String d = node.getContentDescription().toString().trim();
            if (!d.isEmpty()) sb.append(d).append('\n');
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) extractText(child, sb);
        }
    }
}
