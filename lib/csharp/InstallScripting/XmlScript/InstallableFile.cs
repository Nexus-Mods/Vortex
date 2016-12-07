using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// A file or folder that can be installed from a mod.
	/// </summary>
	/// <remarks>
	/// This class describes the location of the file/folder in the Mod, as well as where the
	/// file/folder should be installed.
	/// </remarks>
	public class InstallableFile : IComparable<InstallableFile>
	{
		#region Properties

		/// <summary>
		/// Gets or sets the file's/folder's location in the Mod.
		/// </summary>
		/// <value>The file's/folder's location in the Mod.</value>
		public string Source { get; set; }

		/// <summary>
		/// Gets or sets where the file/folder should be installed.
		/// </summary>
		/// <value>Where the file/folder should be installed.</value>
		public string Destination { get; set; }

		/// <summary>
		/// Gets or sets whether this item is a folder.
		/// </summary>
		/// <value>Whether this item is a folder.</value>
		public bool IsFolder { get; set; }

		/// <summary>
		/// Gets or sets whether this item should always be installed, regardless of whether or not the plugin is selected.
		/// </summary>
		/// <value>Whether this item should always be installed, regardless of whether or not the plugin is selected.</value>
		public bool AlwaysInstall { get; set; }

		/// <summary>
		/// Gets or sets whether this item should be installed if the plugins is usable, regardless of whether or not the plugin is selected.
		/// </summary>
		/// <value>Whether this item should be installed if the plugins is usable, regardless of whether or not the plugin is selected.</value>
		public bool InstallIfUsable { get; set; }

		/// <summary>
		/// Gets or sets the priority of this item.
		/// </summary>
		/// <remarks>
		/// A higher number indicates the file or folder should be installed after the
		/// items with lower numbers. This value does not have to be unique.
		/// </remarks>
		/// <value>The priority of this item.</value>
		public Int32 Priority { get; set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the values of the object.
		/// </summary>
		/// <param name="p_strSource">The file's/folder's location in the Mod.</param>
		/// <param name="p_strDest">Where the file/folder should be installed.</param>
		/// <param name="p_booIsFolder">Whether this item is a folder.</param>
		/// <param name="p_intPriority">The priority of the item.</param>
		/// <param name="p_booAlwaysInstall">Whether this item should always be installed, regardless of whether or not the plugin is selected.</param>
		/// <param name="p_booInstallIfUsable">Whether this item should be installed when the plugin is not <see cref="PluginType.NotUsable"/>, regardless of whether or not the plugin is selected.</param>
		public InstallableFile(string p_strSource, string p_strDest, bool p_booIsFolder, Int32 p_intPriority, bool p_booAlwaysInstall, bool p_booInstallIfUsable)
		{
			Source = p_strSource;
			Destination = p_strDest;
			IsFolder = p_booIsFolder;
			AlwaysInstall = p_booAlwaysInstall;
			InstallIfUsable = p_booInstallIfUsable;
			Priority = p_intPriority;
		}

		#endregion

		#region IComparable<InstallableFile> Members

		/// <summary>
		/// Determines whether this PluginFile is less than, equal to,
		/// or greater than the given PluginFile.
		/// </summary>
		/// <param name="other">The PluginFile to which to compare this PluginFile.</param>
		/// <returns>A value less than 0 if this PluginFile is less than the given PluginFile,
		/// or 0 if this PluginFile is equal to the given PluginFile,
		///or a value greater than 0 if this PluginFile is greater than the given PluginFile.</returns>
		public int CompareTo(InstallableFile other)
		{
			Int32 intResult = Priority.CompareTo(other.Priority);
			if (intResult == 0)
			{
				intResult =IsFolder.CompareTo(other.IsFolder);
				if (intResult == 0)
				{
					intResult = String.Compare(Source, other.Source, StringComparison.OrdinalIgnoreCase);
					if (intResult == 0)
						intResult = String.Compare(Destination, other.Destination, StringComparison.OrdinalIgnoreCase);
				}
			}
			return intResult;
		}

		#endregion
	}
}
