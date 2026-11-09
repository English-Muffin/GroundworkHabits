package app.groundwork.nativebridge;

// Home-screen widget for today's tasks: the habit widget's layout and tick-without-opening, fed from prefs "widgetTasks".
public class TaskWidgetProvider extends WidgetProvider {
    @Override String key() { return "widgetTasks"; }
    @Override String tick() { return "app.groundwork.WIDGET_TASK_TICK"; }
    @Override int codeBase() { return 400; }
}
