using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using Util.Collections;

namespace PluginManagement
{
	/// <summary>
	/// Encapsulates the information about a plugin.
	/// </summary>
	public class Plugin
	{
		#region Properties

		/// <summary>
		/// Gets the description of the plugin.
		/// </summary>
		/// <value>The description of the plugin.</value>
		public string Description { get; private set; }

		/// <summary>
		/// Gets the image of the plugin.
		/// </summary>
		/// <value>The picture of the plugin.</value>
		public Image Picture { get; private set; }

		/// <summary>
		/// Gets the filename of the plugin.
		/// </summary>
		/// <value>The filename of the plugin.</value>
		public string Filename { get; private set; }

		/// <summary>
		/// Gets the list of the plugin's masters.
		/// </summary>
		/// <value>The list of the plugin's masters.</value>
		public Set<string> Masters { get; private set; }

		/// Gets whether the plugin has masters.
		/// </summary>
		/// <value>Whether the plugin has masters.</value>
		public bool HasMasters
		{
			get
			{
				return (Masters != null) && (Masters.Count > 0);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strPath">The filename of the plugin.</param>
		/// <param name="p_strDescription">The description of the plugin.</param>
		/// <param name="p_imgPicture">The picture of the plugin.</param>
		public Plugin(string p_strPath, string p_strDescription, Image p_imgPicture)
		{
			Filename = p_strPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			Description = p_strDescription;
			Picture = p_imgPicture;
			Masters = new Set<string>();
		}

		#endregion

		/// <summary>
		/// Uses the filename to represent the plugin.
		/// </summary>
		/// <returns>The filename.</returns>
		public override string ToString()
		{
			return String.Format("{0} ({1})", Path.GetFileName(Filename), Filename);
		}

		/// <summary>
		/// set the masters required by this plugin
		/// </summary>
		/// <param name="p_lstMasters"></param>
		public void SetMasters(IList<string> p_lstMasters)
		{
			Debug.Assert(p_lstMasters != null);

			Masters = (Set<string>)p_lstMasters.Where(x => !String.IsNullOrEmpty(x));
		}
	}
}
