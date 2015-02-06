augustctl
=========

A node.js module to operate an [August Smart Lock](http://www.august.com/), via BLE.

**This is not developed or officially support by August, it works for me but use at your own risk!**

## Prerequisties

Same as for [noble](https://github.com/sandeepmistry/noble).

On Linux, you will need [bluez 5](http://www.bluez.org/).

Also tested and working on OSX Yosemite.

## Install

	npm install augustctl

## Configuration

It's necessary to have an `offlineKey` and corresponding `offlineKeyOffset` that are recognized by your lock.  

### Android Phone (with Root)

If the phone is rooted, you can copy the `/data/data/com.august.app/shared_prefs/LockSettingsPreferences.xml` file from your phone to your computer.  Many file manager apps, or an adb shell, will let you access it, as long as your phone is rooted.

Run this file through the [tools/decrypt_preferences.js](tools/decrypt_preferences.js) script to view the JSON representation of the preferences.  The script output can be used directly as your configuration file.

    node tools/decrypt_preferences.js LockSettingsPreferences.xml > config.json

The configuration file location can be explicitly set via the AUGUSTCTL_CONFIG environment variable.

### Android Phone (without Root)

It's a little more typing, but on a non-rooted phone, you can open the official app and go to the keychain view (the list of all your "houses"), click on the gear to access the settings, and long click on the application version to access the debug setttings.  As of v1.0.4.1, the password for the debug menu is `KryspyKym`.  In the debug settings display, you should see a JSON object with the offlineKey and offlineKeyOffset.

Place these in a file named `config.json`, which should look something like this:

    { "offlineKey": "0123456789abcdef0123456789abcdef", "offlineKeyOffset": 1 }

Be careful when transcribing the key - one small error and it will not work.

Note: You can also enable Auto-Unlock for Android in the debug menu!

### iPhone

The key and offset can be found in plist located at:

    User Applications/August/Library/Preferences/com.august.iossapp.plist

This can be retrieved by using a file explorer like [http://www.i-funbox.com/ifunboxmac/](iFunBox), and opening the plist in Xcode.

## Usage

Assuming you've configured your offline key and offset, as above, just:

	augustctl unlock
	augustctl lock

That's it!

Alternatively, a simple HTTP API server is available.  From a checked out installation:

    npm start

## License

[MIT](LICENSE)
