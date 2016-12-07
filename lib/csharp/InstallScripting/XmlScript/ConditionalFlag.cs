using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// Describes the value to which to set a given flag.
	/// </summary>
	public class ConditionalFlag
	{
		private string m_strName = null;
		private string m_strValue = null;

		#region Properties

		/// <summary>
		/// Gets or sets the name of the flag to set.
		/// </summary>
		/// <value>The name of the flag to set.</value>
		public string Name
		{
			get
			{
				return m_strName;
			}
			protected set
			{
				m_strName = value;
			}
		}

		/// <summary>
		/// Gets or sets the value to which to set the flag.
		/// </summary>
		/// <value>The value to which to set the flag.</value>
		public string ConditionalValue
		{
			get
			{
				return m_strValue;
			}
			protected set
			{
				m_strValue = value;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the flag to set.</param>
		/// <param name="p_strValue">The name of the flag to set.</param>
		public ConditionalFlag(string p_strName, string p_strValue)
		{
			Name = p_strName;
			ConditionalValue = p_strValue;
		}

		#endregion
	}
}
