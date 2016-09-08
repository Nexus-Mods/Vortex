namespace IniEditing
{
	public interface IIniMethods
	{
		int GetPrivateProfileInt32(string section, string key, int def, string path);
		string GetPrivateProfileString(string section, string key, string def, string path);
		ulong GetPrivateProfileUInt64(string section, string key, ulong def, string path);
		void WritePrivateProfileInt32(string section, string key, int val, string path);
		void WritePrivateProfileString(string section, string key, string val, string path);
	}
}