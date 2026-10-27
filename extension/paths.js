import GLib from 'gi://GLib';

export function cliPath() {
    const configured = GLib.getenv('OMDROP_CLI');
    if (configured && GLib.path_is_absolute(configured)) return configured;
    const local = GLib.build_filenamev([GLib.getenv('XDG_BIN_HOME') || GLib.build_filenamev([GLib.get_home_dir(), '.local/bin']), 'omdrop']);
    if (GLib.file_test(local, GLib.FileTest.IS_EXECUTABLE)) return local;
    return GLib.find_program_in_path('omdrop') || local;
}

export function soundPath(filename) {
    const custom = GLib.getenv('OMDROP_SOUND_DIR');
    if (custom && GLib.path_is_absolute(custom)) return GLib.build_filenamev([custom, filename]);
    // Upstream's user installation layout. Sounds are optional and not vendored.
    return GLib.build_filenamev([GLib.get_user_data_dir(), 'omdrop/share/sounds', filename]);
}
