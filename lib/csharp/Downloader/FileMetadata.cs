using System;
using System.Collections.Generic;
using System.Net;
using System.Text.RegularExpressions;

namespace Downloader
{
	/// <summary>
	/// Describes a file that is to be downloaded.
	/// </summary>
	/// <remarks>
	/// This is simply a friendly representation of the HTTP headers of the file.
	/// </remarks>
	public class FileMetadata
	{
		#region Properties

		/// <summary>
		/// Gets whether the file exists.
		/// </summary>
		/// <value>Whether the file exists.</value>
		public bool Exists { get; private set; }

		/// Gets whether the file exists on the server.
		/// </summary>
		/// <value>Whether the file exists on the server.</value>
		public bool NotFound { get; set; }

		/// <summary>
		/// Gets whether the file is HTML.
		/// </summary>
		/// <value>Whether the file is HTML.</value>
		public bool IsHtml { get; private set; }

		/// <summary>
		/// Gets the length of the file, in bytes.
		/// </summary>
		/// <value>The length of the file, in bytes.</value>
		public UInt64 Length { get; private set; }

		/// <summary>
		/// Gets whether the file supports resuming.
		/// </summary>
		/// <value>Whether the file supports resuming.</value>
		public bool SupportsResume { get; private set; }

		/// <summary>
		/// Gets or sets the filename suggested by the server.
		/// </summary>
		/// <value>The filename suggested by the server.</value>
		public string SuggestedFileName { get; set; }

		/// <summary>
		/// Gets the unique identifier for the file.
		/// </summary>
		/// <value>The unique identifier for the file.</value>
		public string ETag { get; private set; }

		/// <summary>
		/// Gets Nexus error code.
		/// </summary>
		/// <value>The Nexus error code.</value>
		public string NexusError { get; private set; }

		/// <summary>
		/// Gets the Nexus error info.
		/// </summary>
		/// <value>The Nexus error info.</value>
		public string NexusErrorInfo { get; private set; }

		/// <summary>
		/// Gets the other headers that are available for the file.
		/// </summary>
		/// <value>The other headers that are available for the file.</value>
		public Dictionary<string, string[]> Other { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		/// <remarks>
		/// This builds a file meatadata object for a file that doesn't exist.
		/// </remarks>
		public FileMetadata()
		{
			Exists = false;
			NotFound = false;
			IsHtml = false;
			Length = 0;
			SupportsResume = false;
			Other = new Dictionary<string, string[]>();
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_whcFileHeader">The file's HTTP headers.</param>
		public FileMetadata(WebHeaderCollection p_whcFileHeader)
		{
			Exists = true;
			NotFound = false;
			SupportsResume = false;
			Other = new Dictionary<string, string[]>();
			Initialize(p_whcFileHeader);
		}

		#endregion

		/// <summary>
		/// Loads the file metadata from the given HTTP headers.
		/// </summary>
		/// <param name="p_whcFileHeader">The HTTP header collection containing the file's metadata.</param>
		private void Initialize(WebHeaderCollection p_whcFileHeader)
		{
			foreach (string strKey in p_whcFileHeader.Keys)
			{
				switch (strKey)
				{
					case "Content-Disposition":
						Regex rgxFilename = new Regex("filename=([^;]+)");
						Match mchFilename = rgxFilename.Match(p_whcFileHeader.GetValues(strKey)[0]);
						if (mchFilename.Success)
							SuggestedFileName = mchFilename.Groups[1].Value.Trim("\"".ToCharArray());
						break;
					case "Content-Length":
						if (Length == 0)
							Length = UInt64.Parse(p_whcFileHeader.GetValues(strKey)[0]);
						break;
					case "Content-Type":
						IsHtml = p_whcFileHeader.GetValues(strKey)[0].Equals("text/html", StringComparison.OrdinalIgnoreCase);
						break;
					case "Accept-Ranges":
					case "Content-Range":
						string strValue = p_whcFileHeader.GetValues(strKey)[0];
						SupportsResume |= strValue.Contains("bytes");
						if (strKey.Equals("Content-Range") && !String.IsNullOrEmpty(strValue))
						{
							string[] strRange = strValue.Split(' ', '-', '/');
							if (strRange[0].Equals("bytes"))
								Length = UInt64.Parse(strRange[3]);
						}
						break;
					case "ETag":
						ETag = p_whcFileHeader.GetValues(strKey)[0];
						break;
					case "NexusError":
						NexusError = p_whcFileHeader.GetValues(strKey)[0];
						break;
					case "NexusErrorInfo":
						NexusErrorInfo = p_whcFileHeader.GetValues(strKey)[0];
						break;
					default:
						Other[strKey] = p_whcFileHeader.GetValues(strKey);
						break;
				}
			}
		}
	}
}
