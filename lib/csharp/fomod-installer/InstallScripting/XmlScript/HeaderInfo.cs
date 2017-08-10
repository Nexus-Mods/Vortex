using System;
using System.Drawing;
using Utils;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// The posible positions of the title text.
	/// </summary>
	public enum TextPosition
	{
		/// <summary>
		/// Indicates the text should be on the left side of the header.
		/// </summary>
		Left,

		/// <summary>
		/// Indicates the text should be on the right side of the header.
		/// </summary>
		Right,

		/// <summary>
		/// Indicates the text should be on the right side of the image in the header.
		/// </summary>
		RightOfImage
	}

	/// <summary>
	/// This class describes the header of the XML configured script options form.
	/// </summary>
	public class HeaderInfo : ObservableObject
	{
		private string m_strTitle = null;
		private Color m_clrColour = SystemColors.ControlText;
		private TextPosition m_tpsTitlePosition = TextPosition.Right;
		private string m_strImagePath = null;
		private bool m_booShowImage = true;
		private bool m_booShowFade = true;
		private Int32 m_intHeight = 0;

		#region Properties

		/// <summary>
		/// Gets or sets the title of the form.
		/// </summary>
		/// <value>The title of the form.</value>
		public string Title
		{
			get
			{
				return m_strTitle;
			}
			set
			{
				SetPropertyIfChanged(ref m_strTitle, value, () => Title);
			}
		}

		/// <summary>
		/// Gets or sets the colour of the title of the form.
		/// </summary>
		/// <value>The colour of the title of the form.</value>
		public Color TextColour
		{
			get
			{
				return m_clrColour;
			}
			set
			{
				SetPropertyIfChanged(ref m_clrColour, value, () => TextColour);
			}
		}

		/// <summary>
		/// Gets or sets the path to the image to display in the header.
		/// </summary>
		/// <value>The path to the image to display in the header.</value>
		public string ImagePath
		{
			get
			{
				return m_strImagePath;
			}
			set
			{
				SetPropertyIfChanged(ref m_strImagePath, value, () => ImagePath);
			}
		}

		/// <summary>
		/// Gets or sets the position of the title in the header.
		/// </summary>
		/// <value>The position of the title in the header.</value>
		public TextPosition TextPosition
		{
			get
			{
				return m_tpsTitlePosition;
			}
			set
			{
				SetPropertyIfChanged(ref m_tpsTitlePosition, value, () => TextPosition);
			}
		}

		/// <summary>
		/// Gets or sets whether or not to display the image in the header.
		/// </summary>
		/// <value>Whether or not to display the image in the header.</value>
		public bool ShowImage
		{
			get
			{
				return !String.IsNullOrEmpty(ImagePath) && m_booShowImage;
			}
			set
			{
				SetPropertyIfChanged(ref m_booShowImage, value, () => ShowImage);
			}
		}

		/// <summary>
		/// Gets or sets whether or not to display the fade effect in the header.
		/// </summary>
		/// <value>Whether or not to display the fade effect in the header.</value>
		public bool ShowFade
		{
			get
			{
				return m_booShowImage && m_booShowFade;
			}
			set
			{
				SetPropertyIfChanged(ref m_booShowFade, value, () => ShowFade);
			}
		}

		/// <summary>
		/// Gets or sets the desired height of the header.
		/// </summary>
		/// <value>The desired height of the header.</value>
		public Int32 Height
		{
			get
			{
				return m_intHeight;
			}
			set
			{
				SetPropertyIfChanged(ref m_intHeight, value, () => Height);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public HeaderInfo()
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strTitle">The title of the form.</param>
		/// <param name="p_clrColour">The colour of the title of the form.</param>
		/// <param name="p_tpsTitlePosition">The position of the title in the header.</param>
		/// <param name="p_strImagePath">The path to the image to display in the header.</param>
		/// <param name="p_booShowImage">Whether or not to display the image in the header.</param>
		/// <param name="p_booShowFade">Whether or not to display the fade effect in the header.</param>
		/// <param name="p_intHeight">The desired height of the header.</param>
		public HeaderInfo(string p_strTitle, Color p_clrColour, TextPosition p_tpsTitlePosition, string p_strImagePath, bool p_booShowImage, bool p_booShowFade, Int32 p_intHeight)
		{
			m_strTitle = p_strTitle;
			m_clrColour = p_clrColour;
			m_strImagePath = p_strImagePath;
			m_tpsTitlePosition = p_tpsTitlePosition;
			m_booShowImage = p_booShowImage;
			m_booShowFade = p_booShowFade;
			m_intHeight = p_intHeight;
		}

		#endregion
	}
}
