package com.saloncopoya.apk;

import android.accessibilityservice.AccessibilityService;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class CopyTextAccessibilityService extends AccessibilityService {

    private static final String TAG = "CopyTextService";
    private static final long CAPTURE_DEBOUNCE_MS = 400;
    private static final int MAX_LINES = 8000;
    private static final int MAX_CHARS = 500_000;

    private static CopyTextAccessibilityService instance;

    // Estado del modo captura con scroll
    private boolean scrollCaptureActive = false;
    private final StringBuilder captureBuffer = new StringBuilder();
    private final Set<String> captureSeen = new HashSet<>();
    private OnCaptureProgressListener captureListener;
    private final Handler captureHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingCapture;

    /** Callback para que la ventana flotante actualice el contador en vivo. */
    public interface OnCaptureProgressListener {
        void onProgress(int lineCount, int charCount);
    }

    public static CopyTextAccessibilityService getInstance() {
        return instance;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        Log.d(TAG, "Servicio conectado ✓");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }

    @Override
    public void onInterrupt() {}

    /** ==================== MODO CAPTURA CON SCROLL ==================== */

    public void startScrollCapture(OnCaptureProgressListener listener) {
        scrollCaptureActive = true;
        captureBuffer.setLength(0);
        captureSeen.clear();
        captureListener = listener;
        Log.d(TAG, "▶ Captura con scroll INICIADA");

        // Capturar lo que ya está visible
        captureCurrentScreen();
    }

    public String stopScrollCapture() {
        scrollCaptureActive = false;
        // Última captura por si acaso
        captureCurrentScreen();
        captureListener = null;

        String result = captureBuffer.toString();
        Log.d(TAG, "⏹ Captura DETENIDA · " + result.length() + " chars");
        return result;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!scrollCaptureActive) return;

        int type = event.getEventType();
        if (type == AccessibilityEvent.TYPE_VIEW_SCROLLED
                || type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                || type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {

            // Debounce: esperar 400ms de calma antes de capturar
            if (pendingCapture != null) captureHandler.removeCallbacks(pendingCapture);
            pendingCapture = this::captureCurrentScreen;
            captureHandler.postDelayed(pendingCapture, CAPTURE_DEBOUNCE_MS);
        }
    }

    private void captureCurrentScreen() {
        if (!scrollCaptureActive) return;
        if (captureBuffer.length() > MAX_CHARS) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        CharSequence pkgCs = root.getPackageName();
        String pkg = pkgCs == null ? "" : pkgCs.toString();
        if (getPackageName().contentEquals(pkg)) return;   // ignorar mi propia app

        List<String> candidates = new ArrayList<>();
        collectAllText(root, candidates);

        boolean addedAny = false;
        for (String line : candidates) {
            String clean = line.trim();
            if (clean.isEmpty() || clean.length() < 2) continue;
            if (captureSeen.contains(clean)) continue;   // 🔑 dedup
            captureSeen.add(clean);
            captureBuffer.append(clean).append('\n');
            addedAny = true;

            // Límite duro: 8000 líneas o 500KB
            int lines = countLines(captureBuffer);
            if (lines >= MAX_LINES || captureBuffer.length() >= MAX_CHARS) {
                Log.w(TAG, "Límite alcanzado (" + lines + " líneas)");
                break;
            }
        }

        if (addedAny && captureListener != null) {
            final int lines = countLines(captureBuffer);
            final int chars = captureBuffer.length();
            captureHandler.post(() -> captureListener.onProgress(lines, chars));
        }
    }

    private int countLines(StringBuilder sb) {
        int n = 1;
        for (int i = 0; i < sb.length(); i++) if (sb.charAt(i) == '\n') n++;
        return n;
    }

    private void collectAllText(AccessibilityNodeInfo node, List<String> out) {
        if (node == null) return;

        if (node.getText() != null) {
            String t = node.getText().toString().trim();
            if (!t.isEmpty()) out.add(t);
        }
        if (node.getContentDescription() != null) {
            String d = node.getContentDescription().toString().trim();
            if (!d.isEmpty()) out.add(d);
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) collectAllText(child, out);
        }
    }

    /** ==================== COPIA SIMPLE (1 sola vez) ==================== */

    public String copyAllTextFromScreen() {
        StringBuilder sb = new StringBuilder();
        String myPackage = getPackageName();

        List<AccessibilityWindowInfo> windows = getWindows();
        if (windows != null) {
            for (AccessibilityWindowInfo w : windows) {
                AccessibilityNodeInfo root = w.getRoot();
                if (root == null) continue;
                CharSequence pkgCs = root.getPackageName();
                String pkg = pkgCs == null ? "" : pkgCs.toString();
                if (myPackage.contentEquals(pkg)) continue;
                collectAllText(root, new ArrayList<String>() {
                    @Override public boolean add(String s) {
                        sb.append(s).append('\n');
                        return true;
                    }
                });
            }
        }

        if (sb.length() == 0) {
            AccessibilityNodeInfo active = getRootInActiveWindow();
            if (active != null) {
                CharSequence pkgCs = active.getPackageName();
                String pkg = pkgCs == null ? "" : pkgCs.toString();
                if (!myPackage.contentEquals(pkg)) {
                    collectAllText(active, new ArrayList<String>() {
                        @Override public boolean add(String s) {
                            sb.append(s).append('\n');
                            return true;
                        }
                    });
                }
            }
        }

        String text = sb.toString().trim();
        if (text.isEmpty()) return null;

        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        cm.setPrimaryClip(ClipData.newPlainText("Texto copiado", text));
        return text;
    }
}
