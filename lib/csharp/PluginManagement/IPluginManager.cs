using System;
using System.Collections.Generic;
using UI;
using Util.BackgroundTasks;
using Util.Collections;

namespace PluginManagement
{
	/// <summary>
	/// Describes the properties and methods of a plugin manager, which encapsulates managing plugins.
	/// </summary>
	public interface IPluginManager
	{
		#region Properties

		/// <summary>
		/// Gets the list of mods being managed by the mod manager.
		/// </summary>
		/// <value>The list of mods being managed by the mod manager.</value>
		ReadOnlyObservableList<Plugin> ManagedPlugins { get; }

		/// <summary>
		/// Gets the list of plugins to be loaded by the game.
		/// </summary>
		/// <value>The list of active plugins.</value>
		ReadOnlyObservableList<Plugin> ActivePlugins { get; }

		/// <summary>
		/// Gets the max allowed number of active plugins.
		/// </summary>
		/// <value>The max allowed number of active plugins (0 if there's no limit).</value>
		Int32  MaxAllowedActivePluginsCount { get; }

		#endregion

		#region Singleton

		/// <summary>
		/// Releases the manager's hold on physical resources.
		/// </summary>
		void Release();

		#endregion

		#region Plugin Registration

		/// <summary>
		/// Adds the specified plugin to the list of managed plugins.
		/// </summary>
		/// <param name="p_strPluginPath">The path to the plugin to add.</param>
		/// <returns><c>true</c> if the specified plugin was added;
		/// <c>false</c> otherwise.</returns>
		bool AddPlugin(string p_strPluginPath);

		/// <summary>
		/// Removes the given plugin from the list of managed plugins.
		/// </summary>
		/// <param name="p_plgPlugin">The plugin to remove.</param>
		void RemovePlugin(Plugin p_plgPlugin);

		/// <summary>
		/// Removes the specified plugin from the list of managed plugins.
		/// </summary>
		/// <param name="p_strPluginPath">The path to the plugin to remove.</param>
		void RemovePlugin(string p_strPluginPath);

		/// <summary>
		/// Determines if the specified plugin is registered.
		/// </summary>
		/// <param name="p_strPath">The path to the plugin whose registration status is to be determined.</param>
		/// <returns><c>true</c> if the specified plugin is registered;
		/// <c>false</c> otherwise.</returns>
		bool IsPluginRegistered(string p_strPath);

		/// <summary>
		/// Gets the specified plugin.
		/// </summary>
		/// <param name="p_strPath">The path of the plugin to retrieve.</param>
		/// <returns>The specified plugin, or <c>null</c> if the plugin is not registered.</returns>
		Plugin GetRegisteredPlugin(string p_strPath);

		#endregion

		#region Plugin Activation/Deactivation

		/// <summary>
		/// Sets the activations status of the specified plugin.
		/// </summary>
		/// <param name="p_strPath">The path to the plugin whose status is to be set.</param>
		/// <param name="p_booActive">Whether to activate the plugin, or deactivate it.</param>
		void SetPluginActivation(string p_strPath, bool p_booActive);

		/// <summary>
		/// Activates the given plugin.
		/// </summary>
		/// <param name="p_plgPlugin">The plugin to activate.</param>
		void ActivatePlugin(Plugin p_plgPlugin);

		/// <summary>
		/// Activates the specified plugin.
		/// </summary>
		/// <param name="p_strPath">The path to the plugin to activate.</param>
		void ActivatePlugin(string p_strPath);

		/// <summary>
		/// Deactivates the given plugin.
		/// </summary>
		/// <param name="p_plgPlugin">The plugin to deactivate.</param>
		void DeactivatePlugin(Plugin p_plgPlugin);

		/// <summary>
		/// Deactivates the specified plugin.
		/// </summary>
		/// <param name="p_strPath">The path to the plugin to deactivate.</param>
		void DeactivatePlugin(string p_strPath);

		/// <summary>
		/// Determines if the specified plugin is active.
		/// </summary>
		/// <param name="p_strPath">The path to the plugin whose active status is to be determined.</param>
		/// <returns><c>true</c> if the specified plugin is active;
		/// <c>false</c> otherwise.</returns>
		bool IsPluginActive(string p_strPath);

		/// <summary>
		/// Determines if the active state of the given plugin can be changed.
		/// </summary>
		/// <param name="p_plgPlugin">The plugin for which it is to be determined if the active state can be changed.</param>
		/// <returns><c>true</c> if the given plugin's active state can be changed;
		/// <c>false</c> otherwise.</returns>
		bool CanChangeActiveState(Plugin p_plgPlugin);

		#endregion

		#region Plugin Ordering

		/// <summary>
		/// Gets the load order of the specifid plugin.
		/// </summary>
		/// <param name="p_plgPlugin">The plugin whose load order is to be returned.</param>
		/// <returns>The index of the given plugin, or -1 if the plugin is not being managed.</returns>
		Int32 GetPluginOrderIndex(Plugin p_plgPlugin);

		/// <summary>
		/// Sets the load order of the specifid plugin.
		/// </summary>
		/// <param name="p_plgPlugin">The plugin whose load order is to be set.</param>
		/// <param name="p_intNewIndex">The new load order index of the plugin.</param>
		void SetPluginOrderIndex(Plugin p_plgPlugin, int p_intNewIndex);

		/// <summary>
		/// Sets the order of the plugins to the given order.
		/// </summary>
		/// <remarks>
		/// If the given list does not include all registered plugins, then the plugins are ordered in a manner
		/// so as to not displace the positions of the plugins whose order was not specified.
		/// </remarks>
		/// <param name="p_lstOrderedPlugins">The list indicating the desired order of the plugins.</param>
		void SetPluginOrder(IList<Plugin> p_lstOrderedPlugins);

		/// <summary>
		/// Determines if the specified plugin order is valid.
		/// </summary>
		/// <param name="p_lstPlugins">The plugins whose order is to be validated.</param>
		/// <returns><c>true</c> if the given plugins are in a valid order;
		/// <c>false</c> otherwise.</returns>
		bool ValidateOrder(IList<Plugin> p_lstPlugins);

		#endregion

		/// <summary>
		/// Runs the managed updaters.
		/// </summary>
		/// <param name="p_hashMods">The hash of mods.</param>
		/// <param name="p_booEnable">Enable/Disable/Toggle.</param>
		/// <param name="p_camConfirm">The delegate to call to confirm an action.</param>
		/// <returns>The background task that will run the updaters.</returns>
		IBackgroundTask ManageMultiplePluginsTask(List<Plugin> p_lstPlugins, bool p_booEnable, ConfirmActionMethod p_camConfirm);

		/// <summary>
		/// Automatically sorts the managed plugins.
		/// </summary>
		/// <param name="p_camConfirm">The delegate to call to confirm an action.</param>
		/// <returns>The background task that will run the sorting.</returns>
		IBackgroundTask AutoPluginSorting(ConfirmActionMethod p_camConfirm);

		/// <summary>
		/// Determines if the specified file is a plugin that can be activated for the game mode.
		/// </summary>
		/// <param name="p_strPath">The path to the file for which it is to be determined if it is a plugin file.</param>
		/// <returns><c>true</c> if the specified file is a plugin file that can be activated in the game mode;
		/// <c>false</c> otherwise.</returns>
		bool IsActivatiblePluginFile(string p_strPath);

		/// <summary>
		/// Determines if the game mode can handle more active plugins.
		/// </summary>
		/// <returns><c>true</c> if it can;
		/// <c>false</c> otherwise.</returns>
		bool CanActivatePlugins();

		List<Plugin> GetOrphanedPlugins(string p_strMasterName);

		/// <summary>
		/// Gets the plugin description.
		/// </summary>
		string GetPluginDescription(string p_strPlugin);

		/// <summary>
		/// Applies the load order specified by the given list of registered plugins
		/// </summary>
		/// <param name="p_kvpRegisteredPlugins">The list of registered plugins.</param>
		/// <param name="p_booSortingOnly">Whether we just want to apply the sorting.</param>
		IBackgroundTask ApplyLoadOrder(Dictionary<Plugin, string> p_kvpRegisteredPlugins, bool p_booSortingOnly);
	}
}
