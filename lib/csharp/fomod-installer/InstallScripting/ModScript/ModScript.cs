using Utils;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Represents a Mod Script script.
	/// </summary>
	public class ModScript : ObservableObject, IScript
	{
		private string m_strCode = null;

		#region IScript Members

		/// <summary>
		/// Gets the type of the script.
		/// </summary>
		/// <value>The type of the script.</value>
		public IScriptType Type { get; private set; }

		#endregion

		#region Properties

		/// <summary>
		/// Gets or sets the mod script code.
		/// </summary>
		/// <value>The mod script code.</value>
		public string Code
		{
			get
			{
				return m_strCode;
			}
			set
			{
				SetPropertyIfChanged(ref m_strCode, value, () => Code);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_mstScripType">The script's type.</param>
		/// <param name="p_strCode">The mod script code.</param>
		public ModScript(ModScriptType p_mstScripType, string p_strCode)
		{
			Type = p_mstScripType;
			Code = p_strCode;
		}

		#endregion
	}
}
