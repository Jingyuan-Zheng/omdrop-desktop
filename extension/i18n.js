import GLib from 'gi://GLib';

// GLib observes LANGUAGE, LC_ALL, LC_MESSAGES and LANG in locale precedence
// order. Only the preferred language decides; a secondary Chinese fallback
// must not turn an English desktop into a Chinese UI.
export function isChinese(languages = GLib.get_language_names()) {
    return /^zh(?:[_\-.@]|$)/i.test(languages[0] || 'C');
}

export function tr(chinese, english) {
    return isChinese() ? chinese : english;
}

const EN = {
    '接收一个文件后关闭': 'One file, then off',
    '1 分钟': '1 minute', '5 分钟': '5 minutes', '10 分钟': '10 minutes',
    '15 分钟': '15 minutes', '30 分钟': '30 minutes', '1 小时': '1 hour',
    '直到手动关闭': 'Until turned off', '正在读取状态…': 'Reading status…',
    '无线后端不可用': 'Radio backend unavailable', '未开启接收': 'Not receiving',
    '收到一个文件后关闭': 'Until one file arrives', '正在关闭…': 'Turning off…',
    '附近设备可见': 'Visible to nearby devices',
    '接收服务已启动，等待无线广播': 'Receiver started; waiting for radio advertising',
    '设备列表格式错误': 'Invalid device list',
    'Intel 独占模式：开启期间 Wi-Fi 暂时断开': 'Intel exclusive mode: Wi-Fi disconnects while AirDrop is on',
    '接收文件': 'Receive files', '可见时限': 'Stay visible for',
    '允许接收来源': 'Who can send', '所有人': 'Everyone', '仅联系人': 'Contacts Only',
    '管理联系人': 'Manage contacts', '添加 Apple ID 邮箱或电话…': 'Add Apple ID email or phone…',
    '设备名称…': 'Device name…', '设备名称': 'Device name',
    '苹果设备将看到这个名称': 'Apple devices will see this name',
    '保存目录…': 'Save files to…', '打开接收目录': 'Open download folder',
    '发送到附近设备 / 雷达': 'Send to nearby devices / Radar',
    '开启后查找附近设备；雷达位置不代表真实方向': 'Enable to find devices; radar position does not show direction',
    '取消发送': 'Cancel transfer', '正在取消发送…': 'Cancelling transfer…',
    '雷达提示音': 'Radar sounds', '诊断与设置': 'Diagnostics and settings',
    '检查运行环境': 'Check requirements', '运行环境检查': 'Requirements',
    '查看 AirDrop 身份': 'View AirDrop identity', 'AirDrop 身份': 'AirDrop identity',
    '传输容量上限…': 'Transfer size limit…', '传输容量上限': 'Transfer size limit',
    '占当前可用磁盘空间的百分比（1–90）': 'Percentage of free disk space (1–90)',
    '刷新状态': 'Refresh status', '关于 GNOME 移植': 'About Omdrop for GNOME',
    'GNOME Shell 46 原生前端 · v2\n基于 Omdrop 0.16.1 的功能移植。无线后端：omdrop-owl。\n雷达距离仅由信号强度估算，角度为装饰。\n停用此扩展不会自动关闭已开启的接收窗口；可先关闭接收。':
        'Native GNOME Shell 46 frontend · v2\nBased on Omdrop 0.16.1. Radio backend: omdrop-owl.\nRadar distance reflects signal strength; angles are decorative.\nDisabling the extension does not stop an active receive window. Turn receiving off first if needed.',
    '取消': 'Cancel', '确定': 'OK', '保存': 'Save', '关闭': 'Close',
    '没有其他信息': 'No further information', '正在发送文件': 'Transfer in progress',
    '关闭接收会中断传输。请先使用“取消发送”，再关闭接收。': 'Turning receiving off would interrupt the transfer. Cancel the transfer first.',
    '正在应用更改，请稍候…': 'Applying changes. Please wait…',
    ' · 空列表拒收所有人': ' · An empty list refuses everyone',
    '移除联系人': 'Remove contact', '尚未添加联系人': 'No contacts added',
    '添加联系人': 'Add contact', '填写对方 Apple ID 的邮箱或电话号码': 'Enter their Apple ID email or phone number',
    '正在查找… 在苹果设备上开启 AirDrop“所有人”': 'Finding devices… Set AirDrop to Everyone on your Apple device',
    '发送链接': 'Send link', '发送网页链接': 'Send web link',
    '输入 http:// 或 https:// 链接': 'Enter an http:// or https:// link',
    '请输入 http 或 https 链接': 'Enter an http or https link',
    '选择文件…': 'Choose files…', '发送完成': 'Transfer complete', '发送已取消': 'Transfer cancelled',
    '操作未完成': 'Operation did not complete', '扩展已关闭': 'Extension is disabled',
    '已取消': 'Cancelled', '操作超时或已取消': 'Operation timed out or was cancelled', '操作失败': 'Operation failed',
};

export function _(chinese) {
    return isChinese() ? chinese : (EN[chinese] ?? chinese);
}
