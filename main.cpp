#include <gtk/gtk.h>
#include <adwaita.h>
#include <stdio.h>
#include <gst/gst.h>
#include <stdlib.h>
#include <string.h>
#include <vector>
#include <math.h>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <iphlpapi.h>
#pragma comment(lib, "iphlpapi.lib")
#endif

// --- Data Structures ---

typedef struct {
    const char *city;
    int aqi;
    const char *status;
    double pm25;
    double pm10;
    std::vector<int> history; // 24-hour history
} AirQualityData;

// Global state to hold current data for the chart
static AirQualityData current_aqi_data;

// Mock Data Generator
static AirQualityData get_mock_data(const char *city) {
    AirQualityData data;
    data.city = city;
    
    // Simple hash-based randomization for consistent "mock" data per city
    unsigned int hash = 0;
    for (const char *p = city; *p; p++) hash = hash * 31 + *p;
    
    // Use a local seed based on hash for deterministic history
    unsigned int seed = hash;
    auto my_rand = [&seed]() {
        seed = seed * 1103515245 + 12345;
        return (unsigned int)(seed / 65536) % 32768;
    };

    data.aqi = (hash % 300) + 50; // Random AQI between 50 and 350
    
    if (data.aqi <= 50) data.status = "Good 🟢";
    else if (data.aqi <= 100) data.status = "Satisfactory 🟡";
    else if (data.aqi <= 200) data.status = "Moderate 🟠";
    else if (data.aqi <= 300) data.status = "Poor 🔴";
    else data.status = "Very Bad 🔴🔴🔴";

    data.pm25 = (double)(data.aqi) * 0.6;
    data.pm10 = (double)(data.aqi) * 1.2;
    
    // Generate mock history (24 points)
    data.history.clear();
    int current = data.aqi;
    for (int i = 0; i < 24; i++) {
        // Add some random fluctuation
        int fluctuation = (my_rand() % 41) - 20; // -20 to +20
        int val = current + fluctuation;
        if (val < 0) val = 0;
        data.history.insert(data.history.begin(), val);
        current = val;
    }
    
    return data;
}

// --- Live Data State & Helpers ---

static std::vector<int> history_cpu(24, 0);
static std::vector<int> history_mem(24, 0);
static std::vector<int> history_net(24, 0);
static int live_tick = 0;

#ifdef _WIN32
static unsigned long long FileTimeToInt64(const FILETIME & ft) {
    return (((unsigned long long)(ft.dwHighDateTime)) << 32) | ((unsigned long long)ft.dwLowDateTime);
}

static double GetCPULoad() {
    static FILETIME preIdleTime = {0}, preKernelTime = {0}, preUserTime = {0};
    FILETIME idleTime, kernelTime, userTime;
    
    if (!GetSystemTimes(&idleTime, &kernelTime, &userTime)) return 0.0;

    unsigned long long idle = FileTimeToInt64(idleTime) - FileTimeToInt64(preIdleTime);
    unsigned long long kernel = FileTimeToInt64(kernelTime) - FileTimeToInt64(preKernelTime);
    unsigned long long user = FileTimeToInt64(userTime) - FileTimeToInt64(preUserTime);

    preIdleTime = idleTime;
    preKernelTime = kernelTime;
    preUserTime = userTime;

    if (kernel + user == 0) return 0.0;
    
    return (double)(kernel + user - idle) * 100.0 / (kernel + user);
}

static double GetMemoryUsage() {
    MEMORYSTATUSEX memInfo;
    memInfo.dwLength = sizeof(MEMORYSTATUSEX);
    GlobalMemoryStatusEx(&memInfo);
    return (double)memInfo.dwMemoryLoad;
}

static double GetNetworkUsage() {
    static DWORD last_bytes_in = 0;
    static DWORD last_bytes_out = 0;
    static DWORD last_time = 0;
    
    MIB_IFTABLE *pIfTable;
    ULONG dwSize = 0;
    
    if (GetIfTable(NULL, &dwSize, FALSE) == ERROR_INSUFFICIENT_BUFFER) {
        pIfTable = (MIB_IFTABLE *)malloc(dwSize);
    } else {
        return 0.0;
    }
    
    if (GetIfTable(pIfTable, &dwSize, FALSE) == NO_ERROR) {
        DWORD total_in = 0;
        DWORD total_out = 0;
        
        for (int i = 0; i < pIfTable->dwNumEntries; i++) {
            if (pIfTable->table[i].dwType != MIB_IF_TYPE_LOOPBACK) {
                total_in += pIfTable->table[i].dwInOctets;
                total_out += pIfTable->table[i].dwOutOctets;
            }
        }
        
        DWORD current_time = GetTickCount();
        double speed = 0.0;
        
        if (last_time != 0) {
            double time_diff = (current_time - last_time) / 1000.0;
            if (time_diff > 0) {
                long long diff_in = (long long)total_in - last_bytes_in;
                if (diff_in < 0) diff_in += 0xFFFFFFFF;
                long long diff_out = (long long)total_out - last_bytes_out;
                if (diff_out < 0) diff_out += 0xFFFFFFFF;
                
                double bytes_diff = (double)(diff_in + diff_out);
                speed = (bytes_diff * 8) / (1024.0 * 1024.0); // Mbps
                speed = speed / time_diff;
            }
        }
        
        last_bytes_in = total_in;
        last_bytes_out = total_out;
        last_time = current_time;
        
        free(pIfTable);
        return speed;
    }
    
    free(pIfTable);
    return 0.0;
}
#else
static double GetCPULoad() { return (rand() % 100); } 
static double GetMemoryUsage() { return 50.0; }
static double GetNetworkUsage() { return (rand() % 100); }
#endif

static AirQualityData get_live_data(const char *type) {
    AirQualityData data;
    data.city = type;
    data.status = "Live";
    
    if (strstr(type, "CPU")) {
        data.history = history_cpu;
        data.aqi = history_cpu.empty() ? 0 : history_cpu.back();
    } else if (strstr(type, "Mem")) {
        data.history = history_mem;
        data.aqi = history_mem.empty() ? 0 : history_mem.back();
    } else {
        data.history = history_net;
        data.aqi = history_net.empty() ? 0 : history_net.back();
    }
    
    data.pm25 = data.aqi * 0.5;
    data.pm10 = data.aqi * 1.1;
    
    return data;
}

// --- Interaction Callbacks ---

static void on_chart_motion(GtkEventControllerMotion *controller, double x, double y, gpointer user_data) {
    GtkWidget *widget = GTK_WIDGET(user_data);
    g_object_set_data(G_OBJECT(widget), "hover_x", (gpointer)(intptr_t)x);
    g_object_set_data(G_OBJECT(widget), "is_hovering", (gpointer)1);
    gtk_widget_queue_draw(widget);
}

static void on_chart_leave(GtkEventControllerMotion *controller, gpointer user_data) {
    GtkWidget *widget = GTK_WIDGET(user_data);
    g_object_set_data(G_OBJECT(widget), "is_hovering", (gpointer)0);
    gtk_widget_queue_draw(widget);
}

// --- Drawing Callback ---

static void on_draw_chart(GtkDrawingArea *area, cairo_t *cr, int width, int height, gpointer user_data) {
    // Determine which city to draw based on user_data or widget name
    // For simplicity, we'll check the widget name or data attached to it
    const char *city_name = (const char *)g_object_get_data(G_OBJECT(area), "city_name");
    gpointer is_live = g_object_get_data(G_OBJECT(area), "is_live");
    
    AirQualityData data_to_draw;
    
    if (is_live) {
        const char *type = (const char *)g_object_get_data(G_OBJECT(area), "live_type");
        data_to_draw = get_live_data(type ? type : "Unknown");
    } else if (city_name) {
        // If a specific city is attached, fetch its data
        data_to_draw = get_mock_data(city_name);
    } else {
        // Otherwise use the currently selected city data
        if (current_aqi_data.history.empty()) return;
        data_to_draw = current_aqi_data;
    }

    if (data_to_draw.history.empty()) return;

    // Background
    cairo_set_source_rgb(cr, 0.95, 0.95, 0.95);
    cairo_paint(cr);

    // Margins
    double margin_x = 40.0;
    double margin_y = 20.0;
    double graph_w = width - margin_x - 20.0;
    double graph_h = height - 2 * margin_y;

    // Find max value for scaling
    int max_val = 0;
    for (int val : data_to_draw.history) {
        if (val > max_val) max_val = val;
    }
    if (max_val < 100) max_val = 100; // Minimum scale

    // Draw Grid Lines & Labels
    cairo_set_line_width(cr, 1.0);
    cairo_select_font_face(cr, "Sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
    cairo_set_font_size(cr, 10);

    for (int i = 0; i <= 4; i++) {
        double y = margin_y + graph_h - (i * graph_h / 4.0);
        
        // Grid line
        cairo_set_source_rgba(cr, 0.8, 0.8, 0.8, 1.0);
        cairo_move_to(cr, margin_x, y);
        cairo_line_to(cr, margin_x + graph_w, y);
        cairo_stroke(cr);
        
        // Label
        char label[16];
        snprintf(label, sizeof(label), "%d", max_val * i / 4);
        cairo_text_extents_t extents;
        cairo_text_extents(cr, label, &extents);
        
        cairo_set_source_rgb(cr, 0.4, 0.4, 0.4);
        cairo_move_to(cr, margin_x - extents.width - 5, y + extents.height/2 - 2);
        cairo_show_text(cr, label);
    }

    // Draw Graph Line
    cairo_set_source_rgb(cr, 0.2, 0.6, 1.0); // Blue
    cairo_set_line_width(cr, 3.0);
    
    double step_x = graph_w / (data_to_draw.history.size() - 1);
    
    // Path for line
    for (size_t i = 0; i < data_to_draw.history.size(); i++) {
        double x = margin_x + i * step_x;
        double y = margin_y + graph_h - (data_to_draw.history[i] / (double)max_val * graph_h);
        
        if (i == 0) cairo_move_to(cr, x, y);
        else cairo_line_to(cr, x, y);
    }
    cairo_stroke_preserve(cr); // Keep path for fill

    // Fill Gradient
    cairo_line_to(cr, margin_x + graph_w, margin_y + graph_h);
    cairo_line_to(cr, margin_x, margin_y + graph_h);
    cairo_close_path(cr);
    
    cairo_pattern_t *pat = cairo_pattern_create_linear(0, margin_y, 0, margin_y + graph_h);
    cairo_pattern_add_color_stop_rgba(pat, 0, 0.2, 0.6, 1.0, 0.4);
    cairo_pattern_add_color_stop_rgba(pat, 1, 0.2, 0.6, 1.0, 0.0);
    cairo_set_source(cr, pat);
    cairo_fill(cr);
    cairo_pattern_destroy(pat);

    // Draw Current Value Label (Top Right)
    if (is_live && !data_to_draw.history.empty()) {
        int current_val = data_to_draw.history.back();
        const char *type = (const char *)g_object_get_data(G_OBJECT(area), "live_type");
        char label_text[64];
        
        if (type && (strstr(type, "CPU") || strstr(type, "Memory"))) {
            snprintf(label_text, sizeof(label_text), "%d%%", current_val);
        } else if (type && strstr(type, "Network")) {
            snprintf(label_text, sizeof(label_text), "%d MB/s", current_val);
        } else {
            snprintf(label_text, sizeof(label_text), "%d", current_val);
        }
        
        cairo_select_font_face(cr, "Sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD);
        cairo_set_font_size(cr, 24);
        cairo_text_extents_t extents;
        cairo_text_extents(cr, label_text, &extents);
        
        double x = width - margin_x - extents.width;
        double y = margin_y + extents.height;
        
        cairo_set_source_rgba(cr, 0.1, 0.1, 0.1, 0.8);
        cairo_move_to(cr, x, y);
        cairo_show_text(cr, label_text);
    }

    // Draw Current Value Label (Top Right)
    if (is_live && !data_to_draw.history.empty()) {
        int current_val = data_to_draw.history.back();
        const char *type = (const char *)g_object_get_data(G_OBJECT(area), "live_type");
        char label_text[64];
        
        if (type && (strstr(type, "CPU") || strstr(type, "Memory"))) {
            snprintf(label_text, sizeof(label_text), "%d%%", current_val);
        } else if (type && strstr(type, "Network")) {
            snprintf(label_text, sizeof(label_text), "%d Mbps", current_val);
        } else {
            snprintf(label_text, sizeof(label_text), "%d", current_val);
        }
        
        cairo_select_font_face(cr, "Sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD);
        cairo_set_font_size(cr, 24);
        cairo_text_extents_t extents;
        cairo_text_extents(cr, label_text, &extents);
        
        double x = width - margin_x - extents.width;
        double y = margin_y + extents.height;
        
        cairo_set_source_rgba(cr, 0.1, 0.1, 0.1, 0.8);
        cairo_move_to(cr, x, y);
        cairo_show_text(cr, label_text);
    }

    // Interactive Overlay
    gpointer is_hovering = g_object_get_data(G_OBJECT(area), "is_hovering");
    if (is_hovering) {
        int mouse_x = (int)(intptr_t)g_object_get_data(G_OBJECT(area), "hover_x");
        
        // Find closest index
        int index = -1;
        double min_dist = 9999;
        
        for (size_t i = 0; i < data_to_draw.history.size(); i++) {
            double x = margin_x + i * step_x;
            double dist = fabs(x - mouse_x);
            if (dist < min_dist) {
                min_dist = dist;
                index = i;
            }
        }
        
        if (index >= 0 && min_dist < step_x / 1.5) { // Snap tolerance
            double x = margin_x + index * step_x;
            double y = margin_y + graph_h - (data_to_draw.history[index] / (double)max_val * graph_h);
            
            // Draw vertical line
            cairo_set_source_rgba(cr, 0.5, 0.5, 0.5, 0.8);
            cairo_set_line_width(cr, 1.0);
            double dashes[] = {4.0};
            cairo_set_dash(cr, dashes, 1, 0);
            cairo_move_to(cr, x, margin_y);
            cairo_line_to(cr, x, margin_y + graph_h);
            cairo_stroke(cr);
            cairo_set_dash(cr, NULL, 0, 0); // Reset dash
            
            // Draw point
            cairo_set_source_rgb(cr, 1.0, 1.0, 1.0);
            cairo_arc(cr, x, y, 5, 0, 2 * 3.14159);
            cairo_fill_preserve(cr);
            cairo_set_source_rgb(cr, 0.2, 0.6, 1.0);
            cairo_set_line_width(cr, 2.0);
            cairo_stroke(cr);
            
            // Draw Tooltip Box
            char tooltip[32];
            const char* unit = "";
            if (is_live) {
                const char *type = (const char *)g_object_get_data(G_OBJECT(area), "live_type");
                if (type && strstr(type, "Network")) unit = " Mbps";
                else if (type && (strstr(type, "CPU") || strstr(type, "Memory"))) unit = "%";
            }
            snprintf(tooltip, sizeof(tooltip), "%d%s", data_to_draw.history[index], unit);
            
            cairo_select_font_face(cr, "Sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
            cairo_set_font_size(cr, 10);
            cairo_text_extents_t extents;
            cairo_text_extents(cr, tooltip, &extents);
            
            double box_w = extents.width + 10;
            double box_h = extents.height + 10;
            double box_x = x + 10;
            double box_y = y - 10 - box_h;
            
            // Keep tooltip inside bounds
            if (box_x + box_w > width - 20) box_x = x - 10 - box_w;
            if (box_y < margin_y) box_y = y + 10;
            
            cairo_set_source_rgba(cr, 0.2, 0.2, 0.2, 0.9);
            cairo_rectangle(cr, box_x, box_y, box_w, box_h);
            cairo_fill(cr);
            
            cairo_set_source_rgb(cr, 1.0, 1.0, 1.0);
            cairo_move_to(cr, box_x + 5, box_y + box_h - 5);
            cairo_show_text(cr, tooltip);
        }
    }
}

// --- Callbacks ---

static void on_fetch_aqi_clicked(GtkButton *button, gpointer user_data) {
    GtkBuilder *builder = GTK_BUILDER(user_data);
    
    GObject *dropdown_obj = gtk_builder_get_object(builder, "city_dropdown");
    GObject *result_box_obj = gtk_builder_get_object(builder, "aqi_result_box");
    GObject *chart_area_obj = gtk_builder_get_object(builder, "chart_area_current");
    
    if (!dropdown_obj || !result_box_obj) return;
    
    GtkDropDown *dropdown = GTK_DROP_DOWN(dropdown_obj);
    GtkWidget *result_box = GTK_WIDGET(result_box_obj);
    
    // Get selected item
    GtkStringList *model = GTK_STRING_LIST(gtk_drop_down_get_model(dropdown));
    guint selected_idx = gtk_drop_down_get_selected(dropdown);
    const char *city = gtk_string_list_get_string(model, selected_idx);
    
    // Fetch Data
    current_aqi_data = get_mock_data(city);
    
    // Update UI
    GtkLabel *lbl_city = GTK_LABEL(gtk_builder_get_object(builder, "lbl_city_name"));
    GtkLabel *lbl_aqi = GTK_LABEL(gtk_builder_get_object(builder, "lbl_aqi_value"));
    GtkLabel *lbl_status = GTK_LABEL(gtk_builder_get_object(builder, "lbl_aqi_status"));
    GtkLabel *lbl_pm25 = GTK_LABEL(gtk_builder_get_object(builder, "lbl_pm25"));
    GtkLabel *lbl_pm10 = GTK_LABEL(gtk_builder_get_object(builder, "lbl_pm10"));
    
    char buffer[64];
    
    gtk_label_set_text(lbl_city, current_aqi_data.city);
    
    snprintf(buffer, sizeof(buffer), "%d", current_aqi_data.aqi);
    gtk_label_set_text(lbl_aqi, buffer);
    
    gtk_label_set_text(lbl_status, current_aqi_data.status);
    
    snprintf(buffer, sizeof(buffer), "PM2.5: %.1f", current_aqi_data.pm25);
    gtk_label_set_text(lbl_pm25, buffer);
    
    snprintf(buffer, sizeof(buffer), "PM10: %.1f", current_aqi_data.pm10);
    gtk_label_set_text(lbl_pm10, buffer);

    // Update Health Advice
    GtkLabel *lbl_advice = GTK_LABEL(gtk_builder_get_object(builder, "lbl_health_advice"));
    if (lbl_advice) {
        const char* advice = "";
        if (current_aqi_data.aqi <= 50) advice = "Air quality is good. Enjoy outdoor activities!";
        else if (current_aqi_data.aqi <= 100) advice = "Air quality is acceptable. Sensitive groups should limit prolonged outdoor exertion.";
        else if (current_aqi_data.aqi <= 200) advice = "Members of sensitive groups may experience health effects. The general public is not likely to be affected.";
        else if (current_aqi_data.aqi <= 300) advice = "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.";
        else advice = "Health warnings of emergency conditions. The entire population is more likely to be affected.";
        gtk_label_set_text(lbl_advice, advice);
    }

    // Update Status Style
    GtkWidget *status_widget = GTK_WIDGET(lbl_status);
    gtk_widget_remove_css_class(status_widget, "aqi-good");
    gtk_widget_remove_css_class(status_widget, "aqi-ok");
    gtk_widget_remove_css_class(status_widget, "aqi-bad");

    if (current_aqi_data.aqi <= 50) gtk_widget_add_css_class(status_widget, "aqi-good");
    else if (current_aqi_data.aqi <= 100) gtk_widget_add_css_class(status_widget, "aqi-ok");
    else gtk_widget_add_css_class(status_widget, "aqi-bad");
    
    // Show results
    gtk_widget_set_visible(result_box, TRUE);
    
    // Redraw chart
    if (chart_area_obj) {
        gtk_widget_queue_draw(GTK_WIDGET(chart_area_obj));
    }
}

static void on_play_clicked(GtkButton *button, gpointer user_data) {
    GtkBuilder *builder = GTK_BUILDER(user_data);
    GObject *entry_obj = gtk_builder_get_object(builder, "url_entry");
    GObject *video_obj = gtk_builder_get_object(builder, "video_player");

    if (!entry_obj || !video_obj) return;

    GtkEntry *entry = GTK_ENTRY(entry_obj);
    GtkVideo *video = GTK_VIDEO(video_obj);
    
    const char *url = gtk_editable_get_text(GTK_EDITABLE(entry));
    
    if (url && *url) {
        GFile *file = g_file_new_for_uri(url);
        gtk_video_set_file(video, file);
        g_object_unref(file);
    }
}

static gboolean on_live_tick(gpointer user_data) {
    GtkBuilder *builder = GTK_BUILDER(user_data);
    live_tick++;
    
    // Update CPU
    int cpu = (int)GetCPULoad();
    if (history_cpu.size() >= 24) history_cpu.erase(history_cpu.begin());
    history_cpu.push_back(cpu);

    // Update Mem
    int mem = (int)GetMemoryUsage();
    if (history_mem.size() >= 24) history_mem.erase(history_mem.begin());
    history_mem.push_back(mem);

    // Update Net
    int net = (int)GetNetworkUsage(); 
    if (history_net.size() >= 24) history_net.erase(history_net.begin());
    history_net.push_back(net);

    const char *ids[] = {"chart_live_cpu", "chart_live_mem", "chart_live_net", NULL};
    for (const char **id = ids; *id; id++) {
        GObject *obj = gtk_builder_get_object(builder, *id);
        if (obj) gtk_widget_queue_draw(GTK_WIDGET(obj));
    }
    return TRUE; // Continue calling
}

static void load_custom_css() {
    GtkCssProvider *provider = gtk_css_provider_new();
    const char *css_data = 
        "window { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }"
        ".sidebar { background-color: #f8f9fa; border-right: 1px solid #dee2e6; }"
        ".sidebar list { background-color: transparent; }"
        ".sidebar row { padding: 10px 16px; color: #333; font-weight: 500; border-radius: 4px; margin: 2px 8px; }"
        ".sidebar row:selected { color: #0d6efd; background-color: rgba(13, 110, 253, 0.1); }"
        ".dashboard-title { font-size: 28px; font-weight: 600; color: #212529; }"
        ".section-title { font-size: 20px; font-weight: 600; color: #212529; margin-top: 24px; margin-bottom: 16px; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; }"
        ".card { background-color: #fff; border: 1px solid rgba(0,0,0,.125); border-radius: 4px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }"
        ".stat-value { font-size: 28px; font-weight: 700; color: #212529; }"
        ".stat-label { font-size: 13px; color: #6c757d; font-weight: 600; text-transform: uppercase; }"
        ".btn-primary { background-color: #0d6efd; color: white; border-radius: 4px; font-weight: 600; padding: 6px 12px; }"
        ".btn-outline { background-color: white; color: #6c757d; border: 1px solid #6c757d; border-radius: 4px; font-weight: 600; padding: 6px 12px; }"
        ".aqi-good { color: #198754; }"
        ".aqi-ok { color: #fd7e14; }"
        ".aqi-bad { color: #dc3545; }";
    gtk_css_provider_load_from_string(provider, css_data);
    
    GdkDisplay *display = gdk_display_get_default();
    if (display) {
        gtk_style_context_add_provider_for_display(display,
            GTK_STYLE_PROVIDER(provider), GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    }
    g_object_unref(provider);
}

static void on_activate(GtkApplication *app, gpointer user_data) {
    load_custom_css();
    GtkBuilder *builder = gtk_builder_new();
    GError *error = NULL;
    
    if (!gtk_builder_add_from_file(builder, "layout.ui", &error)) {
        g_printerr("Error loading layout.ui: %s\n", error->message);
        g_clear_error(&error);
        return;
    }
    
    GObject *window_obj = gtk_builder_get_object(builder, "window");
    if (!window_obj) {
        g_printerr("Error: No 'window' object in layout.ui\n");
        return;
    }
    
    GtkWindow *window = GTK_WINDOW(window_obj);
    gtk_window_set_application(window, app);
    
    // Connect Signals
    GObject *btn_fetch = gtk_builder_get_object(builder, "btn_fetch_aqi");
    if (btn_fetch) g_signal_connect(btn_fetch, "clicked", G_CALLBACK(on_fetch_aqi_clicked), builder);
    
    GObject *btn_play = gtk_builder_get_object(builder, "play_button");
    if (btn_play) g_signal_connect(btn_play, "clicked", G_CALLBACK(on_play_clicked), builder);
    
    // Connect Chart Drawing
    GObject *chart_current = gtk_builder_get_object(builder, "chart_area_current");
    if (chart_current) {
        gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(chart_current), on_draw_chart, NULL, NULL);
        
        // Add Event Controller
        GtkEventController *motion = gtk_event_controller_motion_new();
        g_signal_connect(motion, "motion", G_CALLBACK(on_chart_motion), chart_current);
        g_signal_connect(motion, "leave", G_CALLBACK(on_chart_leave), chart_current);
        gtk_widget_add_controller(GTK_WIDGET(chart_current), motion);
    }

    GObject *chart_delhi = gtk_builder_get_object(builder, "chart_area_delhi");
    if (chart_delhi) {
        g_object_set_data(G_OBJECT(chart_delhi), "city_name", (gpointer)"New Delhi");
        gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(chart_delhi), on_draw_chart, NULL, NULL);
    }

    GObject *chart_mumbai = gtk_builder_get_object(builder, "chart_area_mumbai");
    if (chart_mumbai) {
        g_object_set_data(G_OBJECT(chart_mumbai), "city_name", (gpointer)"Mumbai");
        gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(chart_mumbai), on_draw_chart, NULL, NULL);
    }

    // Live Charts Setup
    struct LiveChartConfig { const char* id; const char* type; };
    LiveChartConfig live_charts[] = {
        {"chart_live_cpu", "CPU Load"},
        {"chart_live_mem", "Memory Usage"},
        {"chart_live_net", "Network Traffic"}
    };

    for (const auto& cfg : live_charts) {
        GObject *obj = gtk_builder_get_object(builder, cfg.id);
        if (obj) {
            GtkWidget *w = GTK_WIDGET(obj);
            g_object_set_data(G_OBJECT(w), "is_live", (gpointer)1);
            g_object_set_data(G_OBJECT(w), "live_type", (gpointer)cfg.type);
            gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(w), on_draw_chart, NULL, NULL);
            
            // Add interactivity
            GtkEventController *motion = gtk_event_controller_motion_new();
            g_signal_connect(motion, "motion", G_CALLBACK(on_chart_motion), w);
            g_signal_connect(motion, "leave", G_CALLBACK(on_chart_leave), w);
            gtk_widget_add_controller(w, motion);
        }
    }
    
    // Start Live Update Timer
    g_timeout_add(1000, on_live_tick, builder);
    
    gtk_window_present(window);
    g_object_set_data_full(G_OBJECT(window), "builder", builder, g_object_unref);
}

int main(int argc, char *argv[]) {
    // Force GStreamer backend for GTK Media
    g_setenv("GTK_MEDIA_DRIVER", "gstreamer", TRUE);
    
    // Initialize GStreamer
    gst_init(&argc, &argv);
    
    // Initialize LibAdwaita (this initializes GTK as well)
    // Note: AdwApplication handles this automatically, but since we use GtkApplication
    // we should call adw_init() if we want to use Adwaita widgets without AdwApplication.
    // However, using AdwApplication is better.
    
    AdwApplication *app = adw_application_new("com.example.aqi", G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(app, "activate", G_CALLBACK(on_activate), NULL);
    
    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);
    
    return status;
}