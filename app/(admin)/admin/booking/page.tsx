import { getAllSlots, getBookings, deleteSlot } from "@/app/(admin)/actions/booking";
import AddSlotForm from "@/components/Admin/AddSlotForm";
import CancelBookingButton from "@/components/Admin/CancelBookingButton";
import DeleteButton from "@/components/Admin/DeleteButton";

function formatDateTime(date: Date) {
  const d = new Date(date);
  return {
    date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default async function BookingAdminPage() {
  const [slots, bookings] = await Promise.all([getAllSlots(), getBookings()]);

  const upcomingSlots = slots.filter((s) => new Date(s.startsAt) >= new Date());

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Booking</h1>

      <AddSlotForm />

      {/* Available / Upcoming Slots */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Upcoming Slots</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Date</th>
              <th className="px-6 py-4 font-medium text-caption">Time</th>
              <th className="px-6 py-4 font-medium text-caption">Duration</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {upcomingSlots.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-caption">
                  No upcoming slots. Add some above so people can book a call.
                </td>
              </tr>
            ) : (
              upcomingSlots.map((slot: any) => {
                const { date, time } = formatDateTime(slot.startsAt);
                return (
                  <tr key={slot.id} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{date}</td>
                    <td className="px-6 py-4 text-muted">{time}</td>
                    <td className="px-6 py-4 text-muted">{slot.duration} min</td>
                    <td className="px-6 py-4">
                      {slot.isBooked ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background text-muted">
                          Booked{slot.booking ? ` — ${slot.booking.name}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!slot.isBooked && (
                        <DeleteButton id={slot.id} onDelete={deleteSlot} entityName="slot" />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bookings */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Bookings</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">When</th>
              <th className="px-6 py-4 font-medium text-caption">Contact</th>
              <th className="px-6 py-4 font-medium text-caption">Company</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-caption">
                  No bookings yet.
                </td>
              </tr>
            ) : (
              bookings.map((booking: any) => {
                const { date, time } = formatDateTime(booking.slot.startsAt);
                return (
                  <tr key={booking.id} className="hover:bg-background transition-colors align-top">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{date}</div>
                      <div className="text-sm text-muted">{time} · {booking.slot.duration} min</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{booking.name}</div>
                      <div className="text-sm text-muted">{booking.email}</div>
                      {booking.phone && <div className="text-sm text-muted">{booking.phone}</div>}
                    </td>
                    <td className="px-6 py-4 text-muted">{booking.company || "—"}</td>
                    <td className="px-6 py-4">
                      {booking.status === "CANCELLED" ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                          Confirmed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {booking.status === "CONFIRMED" && <CancelBookingButton id={booking.id} />}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
