using System.Threading.Tasks;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// The possible states of a plugin.
	/// </summary>
	public enum PluginState
	{
		/// <summary>
		/// Indicates the plugin is not installed.
		/// </summary>
		Missing,

		/// <summary>
		/// Indicates the plugin is installed, but not active.
		/// </summary>
		Inactive,

		/// <summary>
		/// Indicates the plugin is installed and active.
		/// </summary>
		Active
	}

	/// <summary>
	/// A condition that requires a specified plugin to be in a specified <see cref="PluginState"/>.
	/// </summary>
	public class PluginCondition : ICondition
	{
		private string m_strPluginPath = null;
		private PluginState m_pnsState = PluginState.Active;

		#region Properties

		/// <summary>
		/// Gets the path of the plugin that must be in the specified <see cref="State"/>.
		/// </summary>
		/// <value>The path of the plugin that must be in the specified <see cref="State"/>.</value>
		public string PluginPath
		{
			get
			{
				return m_strPluginPath;
			}
		}

		/// <summary>
		/// Gets the <see cref="ModFileState"/> that the specified <see cref="File"/> must be in.
		/// </summary>
		/// <value>The <see cref="ModFileState"/> that the specified <see cref="File"/> must be in.</value>
		public PluginState State
		{
			get
			{
				return m_pnsState;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strPluginPath">The plugin that must be is the specified state.</param>
		/// <param name="p_pnsState">The state in which the specified plugin must be.</param>
		public PluginCondition(string p_strPluginPath, PluginState p_pnsState)
		{
			m_pnsState = p_pnsState;
			m_strPluginPath = p_strPluginPath;
		}

        #endregion

        #region ICondition Members

        /// <summary>
        /// Gets whether or not the condition is fulfilled.
        /// </summary>
        /// <remarks>
        /// The condition is fulfilled if the specified <see cref="File"/> is in the
        /// specified <see cref="State"/>.
        /// </remarks>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns><c>true</c> if the condition is fulfilled;
        /// <c>false</c> otherwise.</returns>
        /// <seealso cref="ICondition.GetIsFulfilled(CoreDelegates)"/>
        public bool GetIsFulfilled(ConditionStateManager csmState, CoreDelegates coreDelegates)
        {
            string PluginPath = m_strPluginPath;

            if (coreDelegates != null)
            {
                switch (m_pnsState)
                {
                    case PluginState.Active:
                        return coreDelegates.plugin.IsActive(PluginPath).Result;
                    case PluginState.Inactive:
                        return coreDelegates.plugin.IsPresent(PluginPath).Result
                            && !coreDelegates.plugin.IsActive(PluginPath).Result;
                    case PluginState.Missing:
                        return !coreDelegates.plugin.IsPresent(PluginPath).Result;
                }
            }
            return false;
        }

        /// <summary>
        /// Gets a message describing whether or not the condition is fulfilled.
        /// </summary>
        /// <remarks>
        /// If the condition is fulfilled the message is "Passed." If the condition is not fulfilled the
        /// message uses the pattern:
        ///		File '&lt;file>' is not &lt;state>.
        /// </remarks>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>A message describing whether or not the condition is fulfilled.</returns>
        /// <seealso cref="ICondition.GetMessage(CoreDelegates)"/>
        public string GetMessage(ConditionStateManager csmState, CoreDelegates coreDelegates)
        {
            if (GetIsFulfilled(csmState, coreDelegates))
                return "Passed";
            return string.Format("File '{0}' is not {1}.", PluginPath, State.ToString());
        }

        #endregion
    }
}
