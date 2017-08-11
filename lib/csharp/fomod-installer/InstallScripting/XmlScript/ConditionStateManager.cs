
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// This class manages the state of the installation.
	/// </summary>
	public class ConditionStateManager
	{
		/// <summary>
		/// Describe the owner and value of a condition flag.
		/// </summary>
		private class FlagValue
		{
			/// <summary>
			/// The value of the flag.
			/// </summary>
			public string Value;

			/// <summary>
			/// The owner of the flag.
			/// </summary>
			public Option Owner;
		}

		private Dictionary<string, FlagValue> m_dicFlags = new Dictionary<string, FlagValue>();
		private Dictionary<string, Image> m_dicImageCache = new Dictionary<string, Image>();

		#region Properties

        public Version GameVersion
        {
            get
            {
                return new Version("0.0.0.0");
            }
        }

        public Version ApplicationVersion
        {
            get
            {
                return new Version("0.0.0.0");
            }
        }

        /// <summary>
        /// Gets the current values of the flags that have been set.
        /// </summary>
        /// <value>The current values of the flags that have been set.</value>
        public Dictionary<string, string> FlagValues
		{
			get
			{
				Dictionary<string, string> dicValues = new Dictionary<string, string>();
				foreach (KeyValuePair<string, FlagValue> kvpValue in m_dicFlags)
					dicValues[kvpValue.Key] = kvpValue.Value.Value;
				return dicValues;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_modMod">The mod being installed.</param>
		/// <param name="p_gmdGameMode">The game mode currently bieng managed.</param>
		/// <param name="p_pmgPluginManager">The plugin manager.</param>
		/// <param name="p_eifEnvironmentInfo">The application's envrionment info.</param>
		public ConditionStateManager()
		{
		}

		#endregion

		/// <summary>
		/// Sets the value of a conditional flag.
		/// </summary>
		/// <param name="p_strFlagName">The name of the flag whose value is to be set.</param>
		/// <param name="p_strValue">The value to which to set the flag.</param>
		/// <param name="p_pifPlugin">The plugin that is responsible for setting the flag's value.</param>
		public void SetFlagValue(string p_strFlagName, string p_strValue, Option p_pifPlugin)
		{
			if (!m_dicFlags.ContainsKey(p_strFlagName))
				m_dicFlags[p_strFlagName] = new FlagValue();
			m_dicFlags[p_strFlagName].Value = p_strValue;
			m_dicFlags[p_strFlagName].Owner = p_pifPlugin;
		}

		/// <summary>
		/// Removes the all flags owned by the given option.
		/// </summary>
		/// <param name="p_pifPlugin">The owner of the flags to remove.</param>
		public void RemoveFlags(Option p_pifPlugin)
		{
			List<string> lstFlags = new List<string>(m_dicFlags.Keys);
			foreach (string strFlag in lstFlags)
				if (m_dicFlags[strFlag].Owner == p_pifPlugin)
					m_dicFlags.Remove(strFlag);
		}

		/// <summary>
		/// Gets the specified image from the mod against which the script is running.
		/// </summary>
		/// <param name="p_strPath">The path to the image in the mod to retrieve.</param>
		/// <returns>The specified image from the mod against which the script is running.</returns>
		public Image GetImage(string p_strPath)
		{
			if (string.IsNullOrEmpty(p_strPath))
				return null;
			if (!m_dicImageCache.ContainsKey(p_strPath))
			{
				try
				{
                    // ??? Where is this used? Do we need it
                    //m_dicImageCache[p_strPath] = new ExtendedImage(Mod.GetFile(p_strPath));
                    return null;
                }
				catch (FileNotFoundException)
				{
					return null;
				}
			}
			return m_dicImageCache[p_strPath];
		}
	}
}
