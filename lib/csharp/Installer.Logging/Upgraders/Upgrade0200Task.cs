using Mods;
using System;
using System.IO;
using System.Linq;
using System.Xml.Linq;

namespace Installer.Logging.Upgraders
{
	/// <summary>
	/// Upgrades the Install Log to the current version from version 0.2.0.0.
	/// </summary>
	public class Upgrade0200Task : UpgradeTask
	{
		private static readonly Version SUPPORTED_VERSION = new Version("0.2.0.0");

		/// <summary>
		/// Upgrades the install log.
		/// </summary>
		/// <param name="p_mrgModRegistry">The <see cref="ModRegistry"/> that contains the list
		/// of managed mods.</param>
		/// <param name="p_strModInstallDirectory">The path of the directory where all of the mods are installed.</param>
		/// <param name="p_strLogStream">The stream from which to load the install log information.</param>
		protected override void UpgradeInstallLog(Stream p_strLogStream, string p_strModInstallDirectory, IModRegistry p_mrgModRegistry)
		{
			string strModInstallDirectory = p_strModInstallDirectory.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).Trim(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
			XDocument docLog = XDocument.Load(p_strLogStream);

			string strLogVersion = docLog.Element("installLog").Attribute("fileVersion").Value;
			if (!SUPPORTED_VERSION.ToString().Equals(strLogVersion))
				throw new UpgradeException(String.Format("Cannot upgrade Install Log version: {0} Expecting {1}", strLogVersion, SUPPORTED_VERSION));

			XElement xelModList = docLog.Descendants("modList").FirstOrDefault();
			if (xelModList != null)
			{
				foreach (XElement xelMod in xelModList.Elements("mod"))
				{
					string strModName = xelMod.Attribute("name").Value;
					IMod modMod = p_mrgModRegistry.RegisteredMods.FirstOrDefault(x => Path.GetFileNameWithoutExtension(x.Filename).Equals(strModName, StringComparison.CurrentCultureIgnoreCase));
					string strPath = null;
					if (modMod == null)
					{
						if ("FOMM".Equals(strModName))
							modMod = InstallLog.ModManagerValueMod;
						else if ("ORIGINAL_VALUES".Equals(strModName))
							modMod = InstallLog.OriginalValueMod;
						else
							throw new UpgradeException(String.Format("Missing Mod ({0}), cannot upgrade install log.", strModName));
						strPath = modMod.Filename;
					}
					else
						strPath = modMod.Filename.Substring(strModInstallDirectory.Length);
					xelMod.Attribute("name").Remove();
					XElement xelVersion = xelMod.Element("version");
					if (xelVersion != null)
						xelVersion.Remove();
					xelMod.Add(new XAttribute("path", strPath));
					xelMod.Add(new XElement("version",
											new XAttribute("machineVersion", modMod.MachineVersion ?? new Version()),
											new XText(modMod.HumanReadableVersion ?? "0")));
					xelMod.Add(new XElement("name",
											new XText(modMod.ModName)));
				}
			}

			XElement xelFiles = docLog.Descendants("dataFiles").FirstOrDefault();
			if (xelFiles != null)
				foreach (XElement xelFile in xelFiles.Elements("file"))
					xelFile.Attribute("path").Value = Path.Combine("Data", xelFile.Attribute("path").Value);

			docLog.Element("installLog").Attribute("fileVersion").Value = InstallLog.CurrentVersion.ToString();

			p_strLogStream.SetLength(0);
			docLog.Save(p_strLogStream);
		}
	}
}
