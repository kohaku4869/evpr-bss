import { useState } from 'react';
import { useSimulatedFleet } from './hooks/useSimulatedFleet';
import { useAiSuggestions } from './hooks/useAiSuggestions';
import { useSimulatedOrders } from './hooks/useSimulatedOrders';
import { updateStationStatus } from './api';
import { AVG_KM_PER_ORDER, EV_COST_PER_KM_VND, CO2_KG_SAVED_PER_KM } from './data/energyAssumptions';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import KpiBar from './components/KpiBar';
import FleetPanel from './components/FleetPanel';
import StationsPanel from './components/StationsPanel';
import MapPanel from './components/MapPanel';
import SuggestionsPanel from './components/SuggestionsPanel';
import StationIncidentPanel from './components/StationIncidentPanel';
import StationsSection from './components/StationsSection';
import EnergyAnalyticsSection from './components/EnergyAnalyticsSection';
import DriverSettlementSection from './components/DriverSettlementSection';
import styles from './App.module.css';

export default function App() {
  const [section, setSection] = useState('overview');
  const sim = useSimulatedFleet();
  const ai = useAiSuggestions(sim);
  const orders = useSimulatedOrders(sim.avgCongestion);

  const fleetCounts = sim.shippers.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, { driving: 0, idle: 0, charging: 0, maintenance: 0 });
  const lowBatteryCount = sim.shippers.filter((s) => s.battery < 20).length;
  const incidentCount = sim.stations.filter((s) => !s.is_available).length;
  const overloadedCount = sim.stations.filter((s) => s.overloaded).length;

  const handleToggleStation = async (id, isAvailable) => {
    try {
      await updateStationStatus(id, isAvailable);
      await sim.refetchStations();
    } catch (err) {
      console.error('Error updating station status:', err);
    }
  };

  return (
    <div className={styles.app}>
      <TopBar lastUpdated={sim.lastUpdated} />

      <div className={styles.body}>
        <Sidebar
          active={section}
          onChange={setSection}
          pendingCount={ai.pending.length}
          incidentCount={incidentCount}
          overloadedCount={overloadedCount}
        />

        <div className={styles.content}>
          {/* Sections mount/unmount normally (conditional JSX) — only one
              map is ever live at a time this way, which sidesteps Leaflet
              initializing inside a hidden (0×0) container. HeatmapLayer.jsx
              additionally guards leaflet.heat's _redraw against the residual
              async-teardown race (its redraw is scheduled via
              requestAnimationFrame and can still fire a moment after a fast
              section switch unmounts the layer). */}
          {section === 'overview' && (
            <div className={styles.overview}>
              <KpiBar
                fleet={fleetCounts}
                orders={orders}
                lowBatteryCount={lowBatteryCount}
                finance={{
                  costPerOrder: Math.round(AVG_KM_PER_ORDER * EV_COST_PER_KM_VND),
                  co2SavedKg: Math.round(orders.totalOrdersToday * AVG_KM_PER_ORDER * CO2_KG_SAVED_PER_KM),
                }}
              />

              <div className={styles.overviewGrid}>
                <div className={styles.leftCol}>
                  <FleetPanel shippers={sim.shippers} />
                  <StationsPanel stations={sim.stations} />
                </div>
                <div className={styles.centerCol}>
                  <MapPanel
                    stations={sim.stations}
                    shippers={sim.shippers}
                    heatPoints={sim.heatPoints}
                    orderHeatPoints={sim.orderHeatPoints}
                    onToggleStation={handleToggleStation}
                  />
                </div>
              </div>
            </div>
          )}

          {section === 'dispatch' && (
            <div className={styles.dispatchGrid}>
              <div className={styles.dispatchLeft}>
                <StationIncidentPanel stations={sim.stations} onToggle={handleToggleStation} />
              </div>
              <div className={styles.dispatchCenter}>
                <MapPanel
                  stations={sim.stations}
                  shippers={sim.shippers}
                  heatPoints={sim.heatPoints}
                  orderHeatPoints={sim.orderHeatPoints}
                  onToggleStation={handleToggleStation}
                />
              </div>
              <div className={styles.dispatchRight}>
                <SuggestionsPanel
                  pending={ai.pending}
                  decisionLog={ai.decisionLog}
                  stations={sim.stations}
                  shippers={sim.shippers}
                  onApproveGroup={ai.approveGroup}
                  onRejectGroup={ai.rejectGroup}
                  onManualEditGroup={ai.manualEditGroup}
                  onApproveOne={ai.approveOne}
                  onRejectOne={ai.rejectOne}
                  onManualDispatch={ai.logManualEntry}
                />
              </div>
            </div>
          )}

          {section === 'stations' && (
            <StationsSection stations={sim.stations} onToggleStation={handleToggleStation} />
          )}

          {section === 'analytics' && (
            <EnergyAnalyticsSection shippers={sim.shippers} />
          )}

          {section === 'drivers' && (
            <div className={styles.driversWrap}>
              <DriverSettlementSection shippers={sim.shippers} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
